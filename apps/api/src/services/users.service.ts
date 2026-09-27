import { ERROR_CODE, type ListUsersQueryParsed } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { toAccountResponse, toAccountSummary } from '~/mappers/account.mapper';
import accountRepository from '~/repositories/account.repository';
import { ErrorWithStatus } from '~/rules/error';
import { toPage } from '~/utils/pagination';

type ViewerRole = 'MANAGER' | 'RECEPTIONIST';

class UsersService {
  list = async (query: ListUsersQueryParsed, viewerRole: ViewerRole) => {
    const [rows, total] = await accountRepository.listVisible(query, viewerRole);
    return toPage(rows.map(toAccountSummary), total, query);
  };

  getById = async (id: string, viewerRole: ViewerRole) => {
    const account = await accountRepository.findVisibleById(id, viewerRole);
    if (!account) {
      throw new ErrorWithStatus({
        message: 'Không tìm thấy người dùng',
        status: HTTP_STATUS.NOT_FOUND,
        code: ERROR_CODE.NOT_FOUND,
      });
    }
    return toAccountResponse(account);
  };
}

export default new UsersService();
