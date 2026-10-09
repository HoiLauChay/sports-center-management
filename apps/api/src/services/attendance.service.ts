import { ERROR_CODE, type MyAttendanceQuery, type SaveAttendanceBody } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Role } from '~/generated/prisma/client';
import { toAttendanceResponse } from '~/mappers/attendance.mapper';
import { toSessionResponse } from '~/mappers/class.mapper';
import attendanceRepository, { type AttendanceSessionRow } from '~/repositories/attendance.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import { lockRows, runTransaction, withScheduleLock } from '~/utils/transaction';

type Actor = { id: string; role: Role };

const requireSession = (session: AttendanceSessionRow | null, actor: Actor) => {
  if (!session || session.class.deletedAt) {
    throw new ErrorWithStatus({
      status: HTTP_STATUS.NOT_FOUND,
      code: ERROR_CODE.NOT_FOUND,
      message: 'Không tìm thấy buổi học',
    });
  }
  if (actor.role !== 'MANAGER' && (actor.role !== 'COACH' || session.class.coachId !== actor.id)) {
    throw new ErrorWithStatus({
      status: HTTP_STATUS.FORBIDDEN,
      code: ERROR_CODE.FORBIDDEN,
      message: 'Không có quyền điểm danh lớp này',
    });
  }
  return session;
};

class AttendanceService {
  list = async (actor: Actor, id: string) => {
    const session = requireSession(await attendanceRepository.findSession(id), actor);
    const [roster, rows] = await Promise.all([
      attendanceRepository.findRoster(session),
      attendanceRepository.findBySession(id),
    ]);
    const byAccount = new Map(rows.map((row) => [row.accountId, row]));
    return roster.map((account) => toAttendanceResponse(account, byAccount.get(account.id)));
  };

  save = async (actor: Actor, id: string, body: SaveAttendanceBody, ipAddress?: string) =>
    runTransaction(async (tx) => {
      await withScheduleLock(tx);
      const found = requireSession(await attendanceRepository.findSession(id, tx), actor);
      await lockRows(tx, { classes: [found.classId] });
      const session = requireSession(await attendanceRepository.findSession(id, tx), actor);
      if (session.status === 'CANCELLED') {
        throw new ErrorWithStatus({
          status: HTTP_STATUS.CONFLICT,
          code: ERROR_CODE.INVALID_STATE,
          message: 'Không thể điểm danh buổi học đã hủy',
        });
      }
      const roster = await attendanceRepository.findRoster(session, tx);
      const valid = new Set(roster.map(({ id }) => id));
      if (body.records.some(({ accountId }) => !valid.has(accountId))) {
        throw new ErrorWithStatus({
          status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
          code: ERROR_CODE.VALIDATION,
          message: 'Học viên không thuộc buổi học này',
        });
      }
      const byAccount = new Map((await attendanceRepository.findBySession(id, tx)).map((row) => [row.accountId, row]));
      for (const record of body.records) {
        const old = byAccount.get(record.accountId);
        // An omitted note preserves it; an empty string explicitly clears it.
        const note = record.note === undefined ? (old?.note ?? null) : record.note || null;
        if (old?.status === record.status && old.note === note) continue;
        const row = await attendanceRepository.save(
          { sessionId: id, accountId: record.accountId, status: record.status, note, updatedById: actor.id },
          tx,
        );
        await auditService.record(
          {
            accountId: actor.id,
            action: old ? 'UPDATE' : 'CREATE',
            entityType: 'CLASS_ATTENDANCE',
            entityId: row.id,
            // Free text may contain health information: audit only records that the note changed.
            oldValues: old ? { ...old, noteChanged: false } : null,
            newValues: { ...row, noteChanged: old ? old.note !== note : note !== null },
            ipAddress,
          },
          tx,
        );
        byAccount.set(row.accountId, row);
      }
      return roster.map((account) => toAttendanceResponse(account, byAccount.get(account.id)));
    });

  listMine = async (accountId: string, { classId }: MyAttendanceQuery) =>
    (await attendanceRepository.findMine(accountId, classId)).map((row) => ({
      session: toSessionResponse(row),
      status: row.attendances[0]?.status ?? null,
      note: row.attendances[0]?.note ?? null,
    }));
}

export default new AttendanceService();
