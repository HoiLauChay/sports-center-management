import { CRON } from '~/constants/cron';
import attendanceRepository from '~/repositories/attendance.repository';
import auditService from '~/services/audit.service';
import { runTransaction, withScheduleLock } from '~/utils/transaction';

class AttendanceJobService {
  run = (now = new Date()) =>
    runTransaction(async (tx) => {
      await withScheduleLock(tx);
      const missing = await attendanceRepository.findMissingDefaults(now, CRON.BATCH_SIZE, tx);
      const rows = missing.length
        ? await attendanceRepository.createDefaults(
            missing.map(({ sessionId, accountId }) => ({ sessionId, accountId, status: 'ABSENT' })),
            tx,
          )
        : [];
      for (const row of rows) {
        await auditService.record(
          {
            accountId: null,
            action: 'CREATE',
            entityType: 'CLASS_ATTENDANCE',
            entityId: row.id,
            newValues: { ...row, noteChanged: false },
          },
          tx,
        );
      }
      return { processed: rows.length, remaining: await attendanceRepository.countMissingDefaults(now, tx) };
    });
}

export default new AttendanceJobService();
