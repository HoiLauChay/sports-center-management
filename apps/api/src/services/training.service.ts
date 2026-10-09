import {
  ERROR_CODE,
  type CreateAnnouncementBody,
  type CreateEvaluationBody,
  type MyEvaluationsQuery,
  type SaveSessionNoteBody,
  type UpdateEvaluationBody,
} from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Role } from '~/generated/prisma/client';
import { toEvaluationResponse, toSessionNoteResponse } from '~/mappers/training.mapper';
import classRepository from '~/repositories/class.repository';
import enrollmentRepository from '~/repositories/enrollment.repository';
import trainingRepository, { type TrainingSessionRow } from '~/repositories/training.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import notificationService from '~/services/notification.service';
import uploadService from '~/services/upload.service';
import { isUniqueViolation } from '~/utils/dbError';
import { runTransaction } from '~/utils/transaction';

type Actor = { id: string; role: Role };

const notFound = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.NOT_FOUND, code: ERROR_CODE.NOT_FOUND, message });
const forbidden = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.FORBIDDEN, code: ERROR_CODE.FORBIDDEN, message });
const invalidState = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.CONFLICT, code: ERROR_CODE.INVALID_STATE, message });
const invalidStudent = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODE.VALIDATION,
    message: 'Dữ liệu không hợp lệ',
    errors: [{ path: 'body.accountId', message: 'Học viên không thuộc lớp này' }],
  });

const alreadyEvaluated = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.CONFLICT,
    code: ERROR_CODE.CONFLICT,
    message: 'Học viên đã có đánh giá cho buổi này',
  });

const teaches = (actor: Actor, coachId: string | null) => actor.role === 'COACH' && coachId === actor.id;

const requireSession = async (id: string) => {
  const session = await trainingRepository.findSession(id);
  if (!session || session.class.deletedAt) throw notFound('Không tìm thấy buổi học');
  return session;
};

const assertStaff = (actor: Actor, session: TrainingSessionRow) => {
  if (actor.role !== 'MANAGER' && !teaches(actor, session.class.coachId)) {
    throw forbidden('Bạn chỉ thao tác được lớp mình phụ trách');
  }
};

const requireOwnEvaluation = async (actor: Actor, id: string) => {
  const evaluation = await trainingRepository.findEvaluation(id);
  if (!evaluation) throw notFound('Không tìm thấy đánh giá');
  if (actor.role !== 'MANAGER' && evaluation.coachId !== actor.id) {
    throw forbidden('Chỉ người đánh giá hoặc quản lý được sửa đánh giá này');
  }
  return evaluation;
};

class TrainingService {
  getNote = async (actor: Actor, sessionId: string) => {
    const session = await requireSession(sessionId);
    const allowed =
      actor.role === 'MEMBER'
        ? await enrollmentRepository.hasActive(session.classId, actor.id)
        : actor.role === 'MANAGER' || teaches(actor, session.class.coachId);
    if (!allowed) throw forbidden('Bạn không xem được ghi chú của buổi học này');
    return toSessionNoteResponse(session);
  };

  saveNote = async (actor: Actor, sessionId: string, { title, content, attachments }: SaveSessionNoteBody) => {
    const session = await requireSession(sessionId);
    if (!teaches(actor, session.class.coachId)) throw forbidden('Chỉ huấn luyện viên của lớp được viết ghi chú');
    const current = new Set(Array.isArray(session.noteAttachments) ? (session.noteAttachments as string[]) : []);
    attachments.forEach((url, index) => {
      const kept = current.has(url) ? url : null;
      uploadService.assertUploadedFile(url, kept, 'SESSION_ATTACHMENT', actor.id, `body.attachments.${index}`);
    });
    const row = await trainingRepository.saveNote(sessionId, {
      noteTitle: title,
      noteContent: content,
      noteAttachments: attachments,
      noteUpdatedAt: new Date(),
    });
    return toSessionNoteResponse(row)!;
  };

  listSessionEvaluations = async (actor: Actor, sessionId: string) => {
    assertStaff(actor, await requireSession(sessionId));
    return (await trainingRepository.findSessionEvaluations(sessionId)).map(toEvaluationResponse);
  };

  createEvaluation = async (actor: Actor, sessionId: string, body: CreateEvaluationBody, ip?: string) => {
    const { row, notifications } = await runTransaction(async (tx) => {
      const session = await trainingRepository.findSession(sessionId, tx);
      if (!session || session.class.deletedAt) throw notFound('Không tìm thấy buổi học');
      if (!teaches(actor, session.class.coachId)) throw forbidden('Chỉ huấn luyện viên của lớp được đánh giá');
      if (session.status === 'CANCELLED') throw invalidState('Không thể đánh giá buổi học đã hủy');
      if (!(await enrollmentRepository.hasActive(session.classId, body.accountId, tx))) throw invalidStudent();
      if (await trainingRepository.hasEvaluation(sessionId, body.accountId, tx)) throw alreadyEvaluated();
      const row = await trainingRepository.createEvaluation(
        { sessionId, accountId: body.accountId, coachId: actor.id, rating: body.rating, comment: body.comment || null },
        tx,
      );
      await auditService.record(
        {
          accountId: actor.id,
          action: 'CREATE',
          entityType: 'MEMBER_EVALUATION',
          entityId: row.id,
          newValues: row,
          ipAddress: ip,
        },
        tx,
      );
      const notifications = await notificationService.create(
        [
          {
            accountId: body.accountId,
            type: 'TRAINING',
            title: 'Bạn có đánh giá mới',
            message: `Huấn luyện viên đã đánh giá buổi ${row.session.sessionNumber}: ${row.rating}/5.`,
            referenceType: 'CLASS',
            referenceId: session.classId,
          },
        ],
        tx,
      );
      return { row, notifications };
    }).catch((err: unknown) => {
      if (isUniqueViolation(err, 'uq_eval_session_account')) throw alreadyEvaluated();
      throw err;
    });
    notificationService.sendEmailsAfterCommit(notifications);
    return toEvaluationResponse(row);
  };

  updateEvaluation = async (actor: Actor, id: string, body: UpdateEvaluationBody, ip?: string) => {
    const current = await requireOwnEvaluation(actor, id);
    const row = await runTransaction(async (tx) => {
      const updated = await trainingRepository.updateEvaluation(
        id,
        { rating: body.rating, comment: body.comment === undefined ? undefined : body.comment || null },
        tx,
      );
      await auditService.record(
        {
          accountId: actor.id,
          action: 'UPDATE',
          entityType: 'MEMBER_EVALUATION',
          entityId: id,
          oldValues: current,
          newValues: updated,
          ipAddress: ip,
        },
        tx,
      );
      return updated;
    });
    return toEvaluationResponse(row);
  };

  removeEvaluation = async (actor: Actor, id: string, ip?: string) => {
    const current = await requireOwnEvaluation(actor, id);
    await runTransaction(async (tx) => {
      const removed = await trainingRepository.updateEvaluation(id, { deletedAt: new Date() }, tx);
      await auditService.record(
        {
          accountId: actor.id,
          action: 'DELETE',
          entityType: 'MEMBER_EVALUATION',
          entityId: id,
          oldValues: current,
          newValues: removed,
          ipAddress: ip,
        },
        tx,
      );
    });
  };

  listMyEvaluations = async (accountId: string, { classId }: MyEvaluationsQuery) =>
    (await trainingRepository.findMemberEvaluations(accountId, classId)).map(toEvaluationResponse);

  announce = async (actor: Actor, classId: string, { title, body }: CreateAnnouncementBody) => {
    const cls = await classRepository.findDetail(classId);
    if (!cls) throw notFound('Không tìm thấy lớp học');
    if (actor.role !== 'MANAGER' && !teaches(actor, cls.coachId)) {
      throw forbidden('Bạn chỉ gửi thông báo cho lớp mình phụ trách');
    }
    const notifications = await runTransaction(async (tx) => {
      const students = await enrollmentRepository.findActiveByClass(classId, tx);
      return notificationService.create(
        students.map(({ accountId }) => ({
          accountId,
          type: 'TRAINING' as const,
          title,
          message: body,
          referenceType: 'CLASS',
          referenceId: classId,
        })),
        tx,
      );
    });
    return { recipients: notifications.length };
  };
}

export default new TrainingService();
