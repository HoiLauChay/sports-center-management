import {
  ERROR_CODE,
  type CreateSupportBody,
  type ListSupportQuery,
  type SupportStatus,
  type UpdateSupportBody,
} from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Role } from '~/generated/prisma/client';
import { toSupportResponse } from '~/mappers/support.mapper';
import supportRepository from '~/repositories/support.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import notificationService from '~/services/notification.service';
import { toPage } from '~/utils/pagination';
import { lockRows, runTransaction } from '~/utils/transaction';

const NEXT_STATUS: Record<SupportStatus, SupportStatus | null> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'RESOLVED',
  RESOLVED: 'CLOSED',
  CLOSED: null,
};
const STATUS_LABEL: Record<SupportStatus, string> = {
  OPEN: 'Mới',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã xử lý',
  CLOSED: 'Đã đóng',
};

const notFound = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODE.NOT_FOUND,
    message: 'Không tìm thấy yêu cầu hỗ trợ',
  });
const invalidState = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.CONFLICT,
    code: ERROR_CODE.INVALID_STATE,
    message:
      'Trạng thái chỉ được tiến theo thứ tự OPEN → IN_PROGRESS → RESOLVED → CLOSED; yêu cầu đã đóng không thể cập nhật',
  });

class SupportService {
  create = async (accountId: string, body: CreateSupportBody, ip?: string) => {
    const created = await runTransaction(async (tx) => {
      const row = await supportRepository.create({ ...body, accountId }, tx);
      await auditService.record(
        { accountId, action: 'CREATE', entityType: 'SUPPORT_REQUEST', entityId: row.id, newValues: row, ipAddress: ip },
        tx,
      );
      return row;
    });
    return toSupportResponse(created);
  };

  listMine = async (accountId: string) => (await supportRepository.findMine(accountId)).map(toSupportResponse);

  list = async (query: ListSupportQuery) => {
    const [rows, total] = await supportRepository.findPage(query);
    return toPage(rows.map(toSupportResponse), total, query);
  };

  get = async (viewer: { id: string; role: Role }, id: string) => {
    const row = await supportRepository.findById(id);
    if (!row || (viewer.role === 'MEMBER' && row.account.id !== viewer.id)) throw notFound();
    return toSupportResponse(row);
  };

  update = async (staffId: string, id: string, body: UpdateSupportBody, ip?: string) => {
    const updated = await runTransaction(async (tx) => {
      await lockRows(tx, { supportRequests: [id] });
      const current = await supportRepository.findById(id, tx);
      if (!current) throw notFound();
      if (current.status === 'CLOSED' || (body.status !== undefined && NEXT_STATUS[current.status] !== body.status)) {
        throw invalidState();
      }

      const status = body.status ?? current.status;
      const resolutionNote = body.resolutionNote === undefined ? current.resolutionNote : body.resolutionNote || null;
      if ((status === 'RESOLVED' || status === 'CLOSED') && !resolutionNote) {
        throw new ErrorWithStatus({
          status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
          code: ERROR_CODE.VALIDATION,
          message: 'Vui lòng nhập phản hồi cho thành viên trước khi hoàn tất',
          errors: [{ path: 'body.resolutionNote', message: 'Phản hồi không được để trống' }],
        });
      }
      if (status === current.status && resolutionNote === current.resolutionNote) return current;

      const row = await supportRepository.update(
        id,
        {
          status,
          resolutionNote,
          ...(body.status && { handledById: current.handledBy?.id ?? staffId }),
          ...(body.status === 'RESOLVED' && { resolvedAt: new Date() }),
        },
        tx,
      );
      await auditService.record(
        {
          accountId: staffId,
          action: 'UPDATE',
          entityType: 'SUPPORT_REQUEST',
          entityId: id,
          oldValues: current,
          newValues: row,
          ipAddress: ip,
        },
        tx,
      );
      await notificationService.create(
        [
          {
            accountId: current.account.id,
            type: 'SUPPORT',
            title: 'Yêu cầu hỗ trợ được cập nhật',
            message: `${current.subject}: ${STATUS_LABEL[status]}${resolutionNote ? `\n${resolutionNote}` : ''}`,
            referenceType: 'SUPPORT_REQUEST',
            referenceId: id,
            sendEmail: false,
            ...(body.status && { dedupKey: `support:${id}:${status}` }),
          },
        ],
        tx,
      );
      return row;
    });
    return toSupportResponse(updated);
  };
}

export default new SupportService();
