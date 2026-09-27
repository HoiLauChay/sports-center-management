import { ERROR_CODE, type CreateUserBody, type ErrorCode, type ListUsersQuery } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma, Role } from '~/generated/prisma/client';
import { toAccountResponse, toAccountSummary } from '~/mappers/account.mapper';
import accountRepository from '~/repositories/account.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import notificationService from '~/services/notification.service';
import { isUniqueViolation } from '~/utils/dbError';
import { toPage } from '~/utils/pagination';
import { hashPassword } from '~/utils/password';
import { generateOpaqueToken } from '~/utils/token';

interface Viewer {
  id: string;
  role: Role;
}

const visibleRole = (viewer: Viewer): Role | undefined => (viewer.role === 'RECEPTIONIST' ? 'MEMBER' : undefined);

const taken = (code: ErrorCode, field: 'email' | 'phone', message: string) =>
  new ErrorWithStatus({
    status: HTTP_STATUS.CONFLICT,
    code,
    message,
    errors: [{ path: `body.${field}`, message }],
  });

const emailTaken = () => taken(ERROR_CODE.EMAIL_TAKEN, 'email', 'Email đã được đăng ký');
const phoneTaken = () => taken(ERROR_CODE.PHONE_TAKEN, 'phone', 'Số điện thoại đã được sử dụng');

const profileData = ({
  role,
  profile,
}: CreateUserBody): Pick<Prisma.AccountCreateInput, 'coachProfile' | 'receptionistProfile'> =>
  role === 'COACH'
    ? {
        coachProfile: {
          create: { bio: profile?.bio, experience: profile?.experience, certifications: profile?.certifications },
        },
      }
    : { receptionistProfile: { create: { staffNotes: profile?.staffNotes } } };

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

  create = async (viewer: Viewer, body: CreateUserBody, ip?: string) => {
    const { email, fullName, role, phone } = body;
    if (await accountRepository.existsByEmail(email)) throw emailTaken();
    if (phone && (await accountRepository.existsByPhone(phone))) throw phoneTaken();

    const passwordHash = await hashPassword(generateOpaqueToken());

    try {
      const { account, notifications } = await prisma.$transaction(async (tx) => {
        const created = await accountRepository.create(
          { email, fullName, phone, role, passwordHash, ...profileData(body) },
          tx,
        );
        const profile = role === 'COACH' ? created.coachProfile : created.receptionistProfile;
        const entries = [
          ['ACCOUNT', created],
          [role === 'COACH' ? 'COACH_PROFILE' : 'RECEPTIONIST_PROFILE', profile],
        ] as const;
        for (const [entityType, newValues] of entries) {
          await auditService.record(
            { accountId: viewer.id, action: 'CREATE', entityType, entityId: created.id, newValues, ipAddress: ip },
            tx,
          );
        }
        const notifications = await notificationService.create(
          [
            {
              accountId: created.id,
              type: 'SYSTEM',
              title: 'Tài khoản của bạn đã được tạo',
              message:
                'Quản lý trung tâm đã tạo tài khoản Sports Center cho bạn. Để đăng nhập lần đầu, hãy mở trang đăng nhập, chọn "Quên mật khẩu" và nhập email này để đặt mật khẩu.',
              dedupKey: `welcome:${created.id}`,
              sendEmail: true,
            },
          ],
          tx,
        );
        return { account: created, notifications };
      });

      notificationService.sendEmailsAfterCommit(notifications);
      return toAccountResponse(account);
    } catch (err) {
      if (isUniqueViolation(err, 'email_key')) throw emailTaken();
      if (isUniqueViolation(err, 'phone_key')) throw phoneTaken();
      throw err;
    }
  };
}

export default new UserService();
