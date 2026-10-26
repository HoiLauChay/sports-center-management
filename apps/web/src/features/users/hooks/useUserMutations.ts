import type {
  Account,
  ChangeUserEmailBody,
  UpdateUserBody,
  UpdateUserRolesBody,
  UpdateUserStatusBody,
} from '@sports-center/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionQueryOptions } from '~/features/auth';
import { usersService } from '../services/users.service';
import { userDetailQueryKey } from './useUserDetail';

function useSyncUser() {
  const queryClient = useQueryClient();
  return (updated: Account) => {
    queryClient.setQueryData(userDetailQueryKey(updated.id), updated);
    queryClient.setQueryData(sessionQueryOptions.queryKey, (current) =>
      current?.id === updated.id ? updated : current,
    );
    void queryClient.invalidateQueries({
      queryKey: ['users'],
      predicate: (query) => query.queryKey[1] !== 'detail',
    });
  };
}

export function useUpdateUser(id: string) {
  const sync = useSyncUser();
  return useMutation({
    mutationFn: (payload: UpdateUserBody) => usersService.update(id, payload),
    onSuccess: sync,
  });
}

export function useUpdateUserStatus(id: string) {
  const sync = useSyncUser();
  return useMutation({
    mutationFn: (payload: UpdateUserStatusBody) => usersService.updateStatus(id, payload),
    onSuccess: sync,
  });
}

export function useUpdateUserRoles(id: string) {
  const sync = useSyncUser();
  return useMutation({
    mutationFn: (payload: UpdateUserRolesBody) => usersService.updateRoles(id, payload),
    onSuccess: sync,
  });
}

export function useChangeUserEmail(id: string) {
  const sync = useSyncUser();
  return useMutation({
    mutationFn: (payload: ChangeUserEmailBody) => usersService.changeEmail(id, payload),
    onSuccess: sync,
  });
}
