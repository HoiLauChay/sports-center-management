import type { ApiResponse, Invoice } from '@sports-center/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useCurrentUser } from '~/features/auth';
import { checkoutService } from '~/features/checkout/services/checkout.service';
import type { DraftBuyer } from '~/features/checkout/store/cartStore';
import type { Buyer, CheckoutRequest } from '~/features/checkout/types';
import type { MyMemberships } from '~/features/memberships/types';
import { INVOICE_POLL_MS } from '~/features/wallet';
import { privateApi } from '~/lib/http';
import { toApiError } from '~/lib/http-errors';

export function buyerToApi(buyer: DraftBuyer | null): Buyer | undefined {
  if (!buyer) return undefined;
  return buyer.kind === 'MEMBER' ? { accountId: buyer.accountId } : { guest: { name: buyer.name, phone: buyer.phone } };
}

/** Memberships of a member (`GET /users/{id}/memberships`, #93); `null` while the API is not available. */
export function useMemberMemberships(memberId: string | undefined) {
  return useQuery({
    queryKey: ['memberships', 'of', memberId],
    enabled: Boolean(memberId),
    retry: false,
    queryFn: async (): Promise<MyMemberships | null> => {
      try {
        const { data } = await privateApi.get<ApiResponse<MyMemberships>>(
          `/users/${encodeURIComponent(memberId!)}/memberships`,
        );
        return data.result;
      } catch {
        return null;
      }
    },
  });
}

/** Polls a counter transfer invoice every 3 seconds while it waits for money; stops when the screen unmounts. */
export function useCounterInvoice(id: string | undefined) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['counter-invoice', id],
    queryFn: () => checkoutService.getCounterInvoice(user, id!),
    enabled: Boolean(id),
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? INVOICE_POLL_MS : false),
  });
}

export function useStartCounterTransfer() {
  const user = useCurrentUser();
  const { message } = App.useApp();
  return useMutation<Invoice, unknown, CheckoutRequest>({
    mutationFn: (request) => checkoutService.startCounterTransfer(user, request),
    onError: (error) => message.error(toApiError(error).message),
  });
}

export function useCancelCounterInvoice() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => checkoutService.cancelCounterInvoice(id),
    onSuccess: (invoice) => {
      queryClient.setQueryData(['counter-invoice', invoice.id], invoice);
      message.success('Đã hủy hóa đơn');
    },
    onError: (error) => message.error(toApiError(error).message),
  });
}
