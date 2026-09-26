import { zodResolver } from '@hookform/resolvers/zod';
import {
  changePasswordBodySchema,
  ERROR_CODE,
  updateMeBodySchema,
  type Account,
  type ChangePasswordBody,
  type UpdateMeBody,
  type UpdateMeInput,
} from '@sports-center/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useForm } from 'react-hook-form';
import { useConfirm } from '~/hooks/useConfirm';
import { useFormApiError, type ErrorFieldMap } from '~/hooks/useFormApiError';
import { authService } from '../services/auth.service';
import { sessionQueryOptions } from '../session';
import { useEndSession } from './useAuth';

const PROFILE_ERROR_FIELDS: ErrorFieldMap = {
  [ERROR_CODE.PHONE_TAKEN]: 'phone',
};

const CHANGE_PASSWORD_ERROR_FIELDS: ErrorFieldMap = {
  [ERROR_CODE.INVALID_CREDENTIALS]: 'currentPassword',
};

function toProfileFormValues(user: Account): UpdateMeInput {
  const base = {
    fullName: user.fullName,
    phone: user.phone ?? '',
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    address: user.address ?? '',
    avatarUrl: user.avatarUrl ?? '',
  };

  // Only the caller's own role fields are sent; the API ignores the rest anyway.
  if (user.role === 'MEMBER' && 'healthNotes' in user.profile) {
    const { emergencyContact, fitnessGoals, healthNotes } = user.profile;
    return {
      ...base,
      profile: {
        emergencyContact: emergencyContact ?? '',
        fitnessGoals: fitnessGoals ?? '',
        healthNotes: healthNotes ?? '',
      },
    };
  }
  if (user.role === 'COACH' && 'bio' in user.profile) {
    const { bio, experience, certifications, coverImageUrl } = user.profile;
    return {
      ...base,
      profile: {
        bio: bio ?? '',
        experience: experience ?? '',
        certifications: certifications ?? '',
        coverImageUrl: coverImageUrl ?? '',
      },
    };
  }
  return base;
}

export function useUpdateProfile(user: Account, onDone: () => void) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const form = useForm<UpdateMeInput, unknown, UpdateMeBody>({
    resolver: zodResolver(updateMeBodySchema),
    mode: 'onTouched',
    defaultValues: toProfileFormValues(user),
  });
  const handleApiError = useFormApiError(form, PROFILE_ERROR_FIELDS);

  const mutation = useMutation({
    mutationFn: (values: UpdateMeBody) => authService.updateMe(values),
    onSuccess: (updated) => {
      // Header, account menu and profile page all read the session query, so they update without a reload.
      queryClient.setQueryData(sessionQueryOptions.queryKey, updated);
      message.success('Đã cập nhật hồ sơ');
      onDone();
    },
    onError: handleApiError,
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return { form, onSubmit, isSubmitting: mutation.isPending };
}

/** Saves a partial profile change straight away (e.g. a new cover image) without the edit form. */
export function useQuickProfileUpdate() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: UpdateMeBody) => authService.updateMe(values),
    onSuccess: (updated) => {
      queryClient.setQueryData(sessionQueryOptions.queryKey, updated);
      message.success('Đã cập nhật hồ sơ');
    },
  });
}

export function useChangePassword() {
  const endSession = useEndSession();

  const form = useForm<ChangePasswordBody>({
    resolver: zodResolver(changePasswordBodySchema),
    mode: 'onTouched',
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  });
  const handleApiError = useFormApiError(form, CHANGE_PASSWORD_ERROR_FIELDS);

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordBody) => authService.changePassword(values),
    // The API revokes every session and clears the cookies, so the user must sign in again.
    onSuccess: () => endSession('Đổi mật khẩu thành công, vui lòng đăng nhập lại'),
    onError: handleApiError,
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return { form, onSubmit, isSubmitting: mutation.isPending };
}

export function useLogoutAll() {
  const { message } = App.useApp();
  const confirm = useConfirm();
  const endSession = useEndSession();

  return () =>
    confirm({
      title: 'Đăng xuất khỏi mọi thiết bị?',
      content: 'Tất cả phiên đăng nhập, kể cả thiết bị này, sẽ bị đăng xuất.',
      okText: 'Đăng xuất tất cả',
      onOk: async () => {
        try {
          await authService.logoutAll();
          await endSession('Đã đăng xuất khỏi tất cả thiết bị');
        } catch {
          message.error('Không thể đăng xuất, vui lòng thử lại.');
        }
      },
    });
}
