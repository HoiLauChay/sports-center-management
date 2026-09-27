import { ERROR_CODE, type ListUsersQuery } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Role } from '~/generated/prisma/client';
import { toAccountResponse, toAccountSummary } from '~/mappers/account.mapper';
import accountRepository from '~/repositories/account.repository';
import { ErrorWithStatus } from '~/rules/error';
import { toPage } from '~/utils/pagination';

interface Viewer {
  id: string;
  role: Role;
}

const visibleRole = (viewer: Viewer): Role | undefined => (viewer.role === 'RECEPTIONIST' ? 'MEMBER' : undefined);

class UserService {
  list = async (viewer: Viewer, query: ListUsersQuery) => {
    const [rows, total] = await accountRepository.findPage(query, visibleRole(viewer));
    return toPage(rows.map(toAccountSummary), total, query);
  };

  getById = async (viewer: Viewer, id: string) => {
    const account = await accountRepository.findById(id, visibleRole(viewer));
    if (!account) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.NOT_FOUND,
        code: ERROR_CODE.NOT_FOUND,
        message: 'Không tìm thấy người dùng',
      });
    }
    return toAccountResponse(account);
  };
}

export default new UserService();
