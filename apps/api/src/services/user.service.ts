import type { COACH_PROFILE_FIELDS } from '@sports-center/shared';
import {
  ERROR_CODE,
  MEMBER_PROFILE_FIELDS,
  type CreateUserBody,
  type ErrorCode,
  type ListUsersQuery,
  type UpdateUserBody,
  type UpdateUserStatusBody,
} from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma, Role } from '~/generated/prisma/client';
import { toAccountResponse, toAccountSummary } from '~/mappers/account.mapper';
import accountRepository, { type AccountWithProfile } from '~/repositories/account.repository';
import classRepository from '~/repositories/class.repository';
import refreshTokenRepository from '~/repositories/refreshToken.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import notificationService, { type NotificationInput } from '~/services/notification.service';
import { isUniqueViolation } from '~/utils/dbError';
import { pickDefined } from '~/utils/object';
import { toPage } from '~/utils/pagination';
import { hashPassword } from '~/utils/password';
import { generateOpaqueToken } from '~/utils/token';
import { lockRows, runTransaction, withScheduleLock } from '~/utils/transaction';

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

const notFound = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODE.NOT_FOUND,
    message: 'Không tìm thấy người dùng',
  });

const forbidden = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.FORBIDDEN, code: ERROR_CODE.FORBIDDEN, message });

const COACH_EDITABLE_FIELDS = ['bio', 'experience', 'certifications'] as const satisfies readonly Exclude<
  (typeof COACH_PROFILE_FIELDS)[number],
  'coverImageUrl'
>[];
const STAFF_PROFILE_FIELDS = ['staffNotes'] as const;

const profileUpdates = (role: Role, profile: UpdateUserBody['profile']) => ({
  memberProfile: role === 'MEMBER' ? pickDefined(profile, MEMBER_PROFILE_FIELDS) : undefined,
  coachProfile: role === 'COACH' ? pickDefined(profile, COACH_EDITABLE_FIELDS) : undefined,
  receptionistProfile: role === 'RECEPTIONIST' ? pickDefined(profile, STAFF_PROFILE_FIELDS) : undefined,
  managerProfile: role === 'MANAGER' ? pickDefined(profile, STAFF_PROFILE_FIELDS) : undefined,
});

const profileAuditChanges = (current: AccountWithProfile, next: AccountWithProfile) =>
  [
    ['ACCOUNT', current, next],
    ['MEMBER_PROFILE', current.memberProfile, next.memberProfile],
    ['COACH_PROFILE', current.coachProfile, next.coachProfile],
    ['RECEPTIONIST_PROFILE', current.receptionistProfile, next.receptionistProfile],
    ['MANAGER_PROFILE', current.managerProfile, next.managerProfile],
  ] as const;

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
    if (!account) throw notFound();
    return toAccountResponse(account);
  };

  create = async (viewer: Viewer, body: CreateUserBody, ip?: string) => {
    const { email, fullName, role, phone } = body;
    if (await accountRepository.existsByEmail(email)) throw emailTaken();
    if (phone && (await accountRepository.existsByPhone(phone))) throw phoneTaken();

    const passwordHash = await hashPassword(generateOpaqueToken());

    try {
      const { account, notifications } = await runTransaction(async (tx) => {
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

  update = async (viewer: Viewer, id: string, { profile, ...fields }: UpdateUserBody, ip?: string) => {
    const current = await accountRepository.findById(id);
    if (!current) throw notFound();

    if (fields.phone && fields.phone !== current.phone && (await accountRepository.existsByPhone(fields.phone, id))) {
      throw phoneTaken();
    }

    const { dateOfBirth, ...rest } = fields;
    const account: Prisma.AccountUpdateInput = {
      ...rest,
      ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth === null ? null : new Date(dateOfBirth) }),
    };

    try {
      const updated = await runTransaction(async (tx) => {
        const next = await accountRepository.updateProfile(
          id,
          { account, ...profileUpdates(current.role, profile) },
          tx,
        );
        for (const [entityType, oldValues, newValues] of profileAuditChanges(current, next)) {
          if (!oldValues || !newValues) continue;
          await auditService.record(
            { accountId: viewer.id, action: 'UPDATE', entityType, entityId: id, oldValues, newValues, ipAddress: ip },
            tx,
          );
        }
        return next;
      });
      return toAccountResponse(updated);
    } catch (err) {
      if (isUniqueViolation(err, 'phone_key')) throw phoneTaken();
      throw err;
    }
  };

  updateStatus = async (viewer: Viewer, id: string, { status, reason }: UpdateUserStatusBody, ip?: string) => {
    if (id === viewer.id) throw forbidden('Không thể tự đổi trạng thái tài khoản của mình');

    const { account, notifications } = await runTransaction(async (tx) => {
      await withScheduleLock(tx);
      await lockRows(tx, { accounts: [id] });

      const current = await accountRepository.findById(id, undefined, tx);
      if (!current) throw notFound();
      if (current.role === 'MANAGER') throw forbidden('Không thể đổi trạng thái tài khoản quản lý');
      if (current.status === status) return { account: current, notifications: [] };

      const deactivating = status !== 'ACTIVE';
      const inputs =
        deactivating && current.role === 'COACH' ? await this.releaseCoachClasses(viewer, current, tx, ip) : [];

      const next = await accountRepository.updateStatus(id, status, tx);
      await auditService.record(
        {
          accountId: viewer.id,
          action: 'UPDATE',
          entityType: 'ACCOUNT',
          entityId: id,
          oldValues: current,
          newValues: { ...next, statusReason: reason ?? null },
          ipAddress: ip,
        },
        tx,
      );
      if (deactivating) await refreshTokenRepository.revokeAllByAccountId(id, tx);

      return { account: next, notifications: inputs.length > 0 ? await notificationService.create(inputs, tx) : [] };
    });

    notificationService.sendEmailsAfterCommit(notifications);
    return toAccountResponse(account);
  };

  private releaseCoachClasses = async (
    viewer: Viewer,
    coach: AccountWithProfile,
    tx: Prisma.TransactionClient,
    ip?: string,
  ): Promise<NotificationInput[]> => {
    if (await classRepository.hasInProgressForCoach(coach.id, tx)) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.CONFLICT,
        code: ERROR_CODE.HAS_DEPENDENCIES,
        message: 'Huấn luyện viên đang dạy lớp chưa kết thúc, hãy phân công huấn luyện viên khác trước',
      });
    }

    const classes = await classRepository.findNotStartedForCoach(coach.id, tx);
    if (classes.length === 0) return [];

    const ids = classes.map(({ id }) => id);
    await lockRows(tx, { classes: ids });
    const updated = new Map((await classRepository.unassignCoach(ids, tx)).map((row) => [row.id, row]));
    for (const current of classes) {
      await auditService.record(
        {
          accountId: viewer.id,
          action: 'UPDATE',
          entityType: 'CLASS',
          entityId: current.id,
          oldValues: current,
          newValues: updated.get(current.id),
          ipAddress: ip,
        },
        tx,
      );
    }

    const managerIds = await accountRepository.findActiveManagerIds(tx);
    return classes.flatMap(({ id, name, enrollments }) => {
      const reference = { type: 'CLASS', referenceType: 'CLASS', referenceId: id } as const;
      return [
        ...managerIds.map((accountId) => ({
          ...reference,
          accountId,
          title: 'Lớp học cần phân công huấn luyện viên',
          message: `Huấn luyện viên ${coach.fullName} đã bị vô hiệu hóa. Lớp "${name}" đã chuyển về chờ duyệt và cần phân công huấn luyện viên mới.`,
        })),
        ...enrollments.map(({ accountId }) => ({
          ...reference,
          accountId,
          title: 'Lớp học đang đổi huấn luyện viên',
          message: `Lớp "${name}" đang được trung tâm sắp xếp huấn luyện viên mới. Chúng tôi sẽ thông báo khi lớp được xác nhận lại.`,
          sendEmail: true,
        })),
      ];
    });
  };
}

export default new UserService();
