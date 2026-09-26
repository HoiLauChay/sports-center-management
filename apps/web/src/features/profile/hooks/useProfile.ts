import { zodResolver } from '@hookform/resolvers/zod';
import type { Account } from '@sports-center/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useForm } from 'react-hook-form';
import { sessionQueryOptions } from '~/features/auth';
import { useFormApiError } from '~/hooks/useFormApiError';
import { profileSchema, type ProfileFormInput, type ProfileFormValues } from '../schemas/profile.schema';
import { profileService } from '../services/profile.service';
import { getCoachProfile, getMemberProfile } from '../utils/profile';
import { PROFILE_ERROR_FIELDS } from '../utils/profileErrorFields';

function toProfileFormValues(user: Account): ProfileFormInput {
  const base = {
    fullName: user.fullName,
    phone: user.phone ?? '',
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    address: user.address ?? '',
    avatarUrl: user.avatarUrl ?? '',
  };

  const member = getMemberProfile(user);
  if (member) {
    return {
      ...base,
      profile: {
        emergencyContact: member.emergencyContact ?? '',
        fitnessGoals: member.fitnessGoals ?? '',
        healthNotes: member.healthNotes ?? '',
      },
    };
  }

  const coach = getCoachProfile(user);
  if (coach) {
    return {
      ...base,
      profile: {
        bio: coach.bio ?? '',
        experience: coach.experience ?? '',
        certifications: coach.certifications ?? '',
        coverImageUrl: coach.coverImageUrl ?? '',
      },
    };
  }

  return base;
}

export function useSaveProfile() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: ProfileFormValues) => profileService.updateMe(values),
    onSuccess: (updated) => {
      queryClient.setQueryData(sessionQueryOptions.queryKey, updated);
      message.success('Đã cập nhật hồ sơ');
    },
  });
}

export function useUpdateProfile(user: Account, onDone: () => void) {
  const mutation = useSaveProfile();

  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: 'onTouched',
    defaultValues: toProfileFormValues(user),
  });
  const handleApiError = useFormApiError(form, PROFILE_ERROR_FIELDS);

  const onSubmit = form.handleSubmit((values) =>
    mutation.mutate(values, { onSuccess: onDone, onError: handleApiError }),
  );

  return { form, onSubmit, isSubmitting: mutation.isPending };
}
