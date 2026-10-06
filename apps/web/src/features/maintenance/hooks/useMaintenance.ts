import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useCurrentUser } from '~/features/auth';
import { describeApiError } from '~/lib/http-errors';
import { maintenanceService } from '../services/maintenance.service';
import type { CreateMaintenanceBody, ListMaintenancesQuery, MaintenanceRequest } from '../types';

export function useMaintenances(query: ListMaintenancesQuery) {
  return useQuery({
    queryKey: ['maintenance', 'list', query],
    queryFn: () => maintenanceService.list(query),
    placeholderData: keepPreviousData,
  });
}

/** `POST /maintenances/preview` writes nothing, so it is a mutation the wizard fires when the manager asks for it. */
export function useMaintenancePreview() {
  return useMutation({ mutationFn: (request: MaintenanceRequest) => maintenanceService.preview(request) });
}

/** Everything a maintenance can change: facility schedules, bookings, class sessions and wallets. */
function useRefreshAfterMaintenance() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ['maintenance', 'classes', 'bookings', 'wallet', 'orders', 'schedule', 'facility-schedule']) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function useCreateMaintenance() {
  const user = useCurrentUser();
  const refresh = useRefreshAfterMaintenance();
  return useMutation({
    mutationFn: (body: CreateMaintenanceBody) => maintenanceService.create(user, body),
    onSuccess: refresh,
  });
}

export function useDeleteMaintenance() {
  const { message } = App.useApp();
  const refresh = useRefreshAfterMaintenance();
  return useMutation({
    mutationFn: (id: string) => maintenanceService.remove(id),
    onSuccess: () => {
      refresh();
      message.success('Đã hủy lịch bảo trì.');
    },
    onError: (error) => message.error(describeApiError(error)),
  });
}
