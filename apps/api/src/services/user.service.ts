import type { COACH_PROFILE_FIELDS } from '@sports-center/shared';
import {
  ERROR_CODE,
  MEMBER_PROFILE_FIELDS,
  type ChangeUserEmailBody,
  type CreateUserBody,
  type ErrorCode,
  type ListUsersQuery,
  type UpdateUserBody,
  type UpdateUserRolesBody,
  type UpdateUserStatusBody,
} from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma, Role } from '~/generated/prisma/client';
import { toAccountResponse, toAccountSummary, toStudentResponse } from '~/mappers/account.mapper';
import accountRepository, { type AccountWithProfile } from '~/repositories/account.repository';
import classRepository from '~/repositories/class.repository';
import enrollmentRepository from '~/repositories/enrollment.repository';
import refreshTokenRepository from '~/repositories/refreshToken.repository';
import sessionRepository from '~/repositories/session.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import authService from '~/services/auth.service';
import notificationService, { type NotificationInput } from '~/services/notification.service';
import { notifyOpenClasses } from '~/services/openClassNotice';
import { isUniqueViolation } from '~/utils/dbError';
import { pickDefined } from '~/utils/object';
import { toPage } from '~/utils/pagination';
import { todayInCenter } from '~/utils/time';
import { lockRows, runTransaction, withScheduleLock } from '~/utils/transaction';

interface Viewer {
  id: string;
  role: Role;
}

const ROLE_LABEL: Record<Role, string> = {
  MANAGER: 'Quản lý',
  COACH: 'Huấn luyện viên',
  MEMBER: 'Thành viên',
  RECEPTIONIST: 'Lễ tân',
};

const visibleRole = (viewer: Viewer): Role | undefined =>
  ['RECEPTIONIST', 'COACH'].includes(viewer.role) ? 'MEMBER' : undefined;

const taken = (code: ErrorCode, field: 'email' | 'phone', message: string) =>
  new ErrorWithStatus({
    status: HTTP_STATUS.CONFLICT,
    code,
    message,
    errors: [{ path: `body.${field}`, message }],
  });

const emailTaken = () => taken(ERROR_CODE.EMAIL_TAKEN, 'email', 'Email đã được đăng ký');
const phoneTaken = () => taken(ERROR_CODE.PHONE_TAKEN, 'phone', 'Số điện thoại đã được sử dụng');

const withPasswordState = <T extends { passwordHash: string | null }>(account: T) => ({
  ...account,
  mustSetPassword: account.passwordHash === null,
});

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
    if (viewer.role === 'COACH' && !(await enrollmentRepository.hasCurrentStudent(viewer.id, id))) throw notFound();
    const account = await accountRepository.findById(id, visibleRole(viewer));
    if (!account) throw notFound();
    return viewer.role === 'COACH' ? toStudentResponse(account) : toAccountResponse(account);
  };

  create = async (viewer: Viewer, body: CreateUserBody, ip?: string) => {
    const { email, fullName, role, phone } = body;
    if (await accountRepository.existsByEmail(email)) throw emailTaken();
    if (phone && (await accountRepository.existsByPhone(phone))) throw phoneTaken();

    try {
      const { account, activationUrl } = await runTransaction(async (tx) => {
        const created = await accountRepository.create(
          { email, fullName, phone, role, roles: [role], ...profileData(body) },
          tx,
        );
        const profile = role === 'COACH' ? created.coachProfile : created.receptionistProfile;
        const entries = [
          ['ACCOUNT', withPasswordState(created)],
          [role === 'COACH' ? 'COACH_PROFILE' : 'RECEPTIONIST_PROFILE', profile],
        ] as const;
        for (const [entityType, newValues] of entries) {
          await auditService.record(
            { accountId: viewer.id, action: 'CREATE', entityType, entityId: created.id, newValues, ipAddress: ip },
            tx,
          );
        }
        await notificationService.create(
          [
            {
              accountId: created.id,
              type: 'SYSTEM',
              title: 'Tài khoản của bạn đã được tạo',
              message: 'Quản lý trung tâm đã tạo tài khoản Sports Center cho bạn. Chào mừng bạn đến với Sports Center.',
              dedupKey: `welcome:${created.id}`,
            },
          ],
          tx,
        );
        return { account: created, activationUrl: await authService.createActivationLink(email, tx) };
      });

      authService.sendActivationAfterCommit(account.email, account.fullName, activationUrl, 'CREATED');
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
      if (current.roles.includes('MANAGER')) throw forbidden('Không thể đổi trạng thái tài khoản quản lý');
      if (current.status === status) return { account: current, notifications: [] };

      const deactivating = status !== 'ACTIVE';
      const inputs =
        deactivating && current.roles.includes('COACH')
          ? await this.releaseCoachClasses(viewer, current, 'đã bị vô hiệu hóa', tx, ip)
          : [];

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
      inputs.push({
        accountId: id,
        type: 'SYSTEM',
        title: deactivating ? 'Tài khoản đã bị khóa' : 'Tài khoản đã được mở lại',
        message: deactivating
          ? `Tài khoản Sports Center của bạn đã bị ${status === 'BANNED' ? 'khóa' : 'vô hiệu hóa'} và không đăng nhập được.${reason ? ` Lý do: ${reason}` : ''}`
          : 'Tài khoản Sports Center của bạn đã hoạt động trở lại, bạn có thể đăng nhập.',
        sendEmail: true,
      });

      return { account: next, notifications: await notificationService.create(inputs, tx) };
    });

    notificationService.sendEmailsAfterCommit(notifications);
    return toAccountResponse(account);
  };

  updateRoles = async (viewer: Viewer, id: string, { roles }: UpdateUserRolesBody, ip?: string) => {
    const { account, notifications } = await runTransaction(async (tx) => {
      await withScheduleLock(tx);
      await lockRows(tx, { accounts: [id] });

      const current = await accountRepository.findById(id, undefined, tx);
      if (!current) throw notFound();
      if (current.roles.includes('MANAGER')) throw forbidden('Không thể đổi vai trò tài khoản quản lý');
      if (roles.length === current.roles.length && roles.every((role) => current.roles.includes(role))) {
        return { account: current, notifications: [] };
      }

      const inputs =
        current.roles.includes('COACH') && !roles.includes('COACH') && current.status === 'ACTIVE'
          ? await this.releaseCoachClasses(viewer, current, 'không còn là huấn luyện viên', tx, ip)
          : [];
      const next = await accountRepository.updateRoles(
        id,
        roles,
        (roles as Role[]).includes(current.role) ? current.role : roles[0]!,
        tx,
      );
      await auditService.record(
        {
          accountId: viewer.id,
          action: 'UPDATE',
          entityType: 'ACCOUNT',
          entityId: id,
          oldValues: withPasswordState(current),
          newValues: withPasswordState(next),
          ipAddress: ip,
        },
        tx,
      );
      inputs.push({
        accountId: id,
        type: 'SYSTEM',
        title: 'Vai trò tài khoản đã được cập nhật',
        message: `Tài khoản của bạn hiện có vai trò: ${roles.map((role) => ROLE_LABEL[role]).join(', ')}.`,
      });
      return { account: next, notifications: await notificationService.create(inputs, tx) };
    });

    notificationService.sendEmailsAfterCommit(notifications);
    return toAccountResponse(account);
  };

  changeEmail = async (viewer: Viewer, id: string, { email }: ChangeUserEmailBody, ip?: string) => {
    const invalidState = (message: string) =>
      new ErrorWithStatus({ status: HTTP_STATUS.CONFLICT, code: ERROR_CODE.INVALID_STATE, message });
    if (id === viewer.id) throw invalidState('Không thể tự đổi email của mình');

    try {
      const { account, activationUrl } = await this.replaceEmail(viewer, id, email, invalidState, ip);
      authService.sendActivationAfterCommit(account.email, account.fullName, activationUrl, 'EMAIL_CHANGED');
      return toAccountResponse(account);
    } catch (err) {
      if (isUniqueViolation(err, 'email_key')) throw emailTaken();
      throw err;
    }
  };

  private replaceEmail = (
    viewer: Viewer,
    id: string,
    email: string,
    invalidState: (message: string) => ErrorWithStatus,
    ip?: string,
  ) =>
    runTransaction(async (tx) => {
      await lockRows(tx, { accounts: [id] });
      const current = await accountRepository.findById(id, undefined, tx);
      if (!current) throw notFound();
      if (current.email === email) throw invalidState('Email mới trùng email hiện tại');
      if (await accountRepository.existsByEmail(email)) throw emailTaken();

      const next = await accountRepository.replaceEmail(id, email, tx);
      await refreshTokenRepository.revokeAllByAccountId(id, tx);
      await auditService.record(
        {
          accountId: viewer.id,
          action: 'UPDATE',
          entityType: 'ACCOUNT',
          entityId: id,
          oldValues: withPasswordState(current),
          newValues: withPasswordState(next),
          ipAddress: ip,
        },
        tx,
      );
      await notificationService.create(
        [
          {
            accountId: id,
            type: 'SYSTEM',
            title: 'Email tài khoản đã được cập nhật',
            message: `Quản lý trung tâm đã đổi email đăng nhập Sports Center của bạn sang ${email}.`,
            dedupKey: `email-changed:${id}:${next.passwordChangedAt.getTime()}`,
          },
        ],
        tx,
      );
      return { account: next, activationUrl: await authService.createActivationLink(email, tx) };
    });

  private releaseCoachClasses = async (
    viewer: Viewer,
    coach: AccountWithProfile,
    reason: string,
    tx: Prisma.TransactionClient,
    ip?: string,
  ): Promise<NotificationInput[]> => {
    if (await classRepository.hasInProgressForCoach(coach.id, tx)) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.CONFLICT,
        code: ERROR_CODE.HAS_DEPENDENCIES,
        message: 'Không khóa được huấn luyện viên đang dạy lớp chưa kết thúc',
      });
    }

    await sessionRepository.clearSubstitutes(coach.id, todayInCenter(), tx);
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

    await notifyOpenClasses(tx, classes, coach.id);
    const managerIds = await accountRepository.findActiveManagerIds(tx);
    return classes.flatMap(({ id, name, enrollments }) => {
      const reference = { type: 'CLASS', referenceType: 'CLASS', referenceId: id } as const;
      return [
        ...managerIds.map((accountId) => ({
          ...reference,
          accountId,
          title: 'Lớp học cần phân công huấn luyện viên',
          message: `Huấn luyện viên ${coach.fullName} ${reason}. Lớp "${name}" đã chuyển về chờ duyệt và cần phân công huấn luyện viên mới.`,
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
