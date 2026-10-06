import {
  ERROR_CODE,
  SUPPORT_STATUSES,
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
import notificationService from '~/services/notification.service';
import { toPage } from '~/utils/pagination';
import { lockRows, runTransaction } from '~/utils/transaction';

const STATUS_LABEL: Record<SupportStatus, string> = {
  OPEN: 'Mới',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã xử lý',
  CLOSED: 'Đã đóng',
};

const rank = (status: SupportStatus) => SUPPORT_STATUSES.indexOf(status);

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
    message: 'Trạng thái yêu cầu hỗ trợ chỉ được chuyển tiếp; yêu cầu đã đóng không thể cập nhật',
  });

const noteRequired = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODE.VALIDATION,
    message: 'Dữ liệu không hợp lệ',
    errors: [{ path: 'body.resolutionNote', message: 'Vui lòng nhập phản hồi cho thành viên trước khi hoàn tất' }],
  });

class SupportService {
  create = async (accountId: string, body: CreateSupportBody) =>
    toSupportResponse(await supportRepository.create({ ...body, accountId }));

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

  update = async (staffId: string, id: string, body: UpdateSupportBody) => {
    const { row, notifications } = await runTransaction(async (tx) => {
      await lockRows(tx, { supportRequests: [id] });
      const current = await supportRepository.findById(id, tx);
      if (!current) throw notFound();
      if (current.status === 'CLOSED' || (body.status && rank(body.status) <= rank(current.status))) {
        throw invalidState();
      }

      const status = body.status ?? current.status;
      const resolutionNote = body.resolutionNote ?? current.resolutionNote;
      if (rank(status) >= rank('RESOLVED') && !resolutionNote) throw noteRequired();

      const row = await supportRepository.update(
        id,
        {
          status,
          resolutionNote,
          handledById: current.handledBy?.id ?? staffId,
          resolvedAt: current.resolvedAt ?? (rank(status) >= rank('RESOLVED') ? new Date() : null),
        },
        tx,
      );
      const notifications = await notificationService.create(
        [
          {
            accountId: current.account.id,
            type: 'SUPPORT',
            title: 'Yêu cầu hỗ trợ được cập nhật',
            message: `${current.subject}: ${STATUS_LABEL[status]}${resolutionNote ? `. ${resolutionNote}` : ''}`,
            referenceType: 'SUPPORT_REQUEST',
            referenceId: id,
            ...(body.status && { dedupKey: `support:${id}:${status}` }),
          },
        ],
        tx,
      );
      return { row, notifications };
    });
    notificationService.sendEmailsAfterCommit(notifications);
    return toSupportResponse(row);
  };
}

export default new SupportService();
