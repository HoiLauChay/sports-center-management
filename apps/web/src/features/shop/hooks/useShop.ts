import type { ListProductSalesInput, ListProductsInput } from '@sports-center/shared';
import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { shopService } from '../services/shop.service';

export const shopKeys = {
  all: ['shop'] as const,
  categories: (includeInactive: boolean) => ['shop', 'categories', includeInactive] as const,
  products: (params: ListProductsInput) => ['shop', 'products', params] as const,
  product: (id: string) => ['shop', 'product', id] as const,
  movements: (id: string, page: number) => ['shop', 'movements', id, page] as const,
  sales: (params: ListProductSalesInput) => ['shop', 'sales', params] as const,
  report: (from: string, to: string) => ['shop', 'report', from, to] as const,
};

export const categoriesQueryOptions = (includeInactive = false) =>
  queryOptions({
    queryKey: shopKeys.categories(includeInactive),
    queryFn: () => shopService.categories(includeInactive),
  });

export function useProductCategories(includeInactive = false) {
  return useQuery(categoriesQueryOptions(includeInactive));
}

export function useProducts(params: ListProductsInput, enabled = true) {
  return useQuery({
    queryKey: shopKeys.products(params),
    queryFn: () => shopService.products(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useStockMovements(productId: string | null, page: number) {
  return useQuery({
    queryKey: shopKeys.movements(productId ?? '', page),
    queryFn: () => shopService.movements(productId!, { page, limit: 10 }),
    enabled: Boolean(productId),
    placeholderData: keepPreviousData,
  });
}

export function useProductSales(params: ListProductSalesInput) {
  return useQuery({
    queryKey: shopKeys.sales(params),
    queryFn: () => shopService.sales(params),
    placeholderData: keepPreviousData,
    // The counter waits on orders paid elsewhere, so the list keeps itself fresh like the other counter screens.
    refetchInterval: 30_000,
  });
}

export function useShopReport(from: string, to: string) {
  return useQuery({
    queryKey: shopKeys.report(from, to),
    queryFn: () => shopService.report({ from, to }),
    placeholderData: keepPreviousData,
  });
}

/** Invalidates everything that shows stock or a sale: shop lists, orders and the member's wallet. */
export function useRefreshShop() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: shopKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['orders'] }),
      queryClient.invalidateQueries({ queryKey: ['wallet'] }),
    ]);
}

export function useSaleActions() {
  const { message } = App.useApp();
  const refresh = useRefreshShop();

  const pickup = useMutation({
    mutationFn: (saleId: string) => shopService.pickup(saleId),
    onSuccess: (sale) => {
      void refresh();
      message.success(`Đã giao ${sale.quantity} × ${sale.product.name}`);
    },
    onError: (error) => message.error(toApiError(error).message),
  });

  const cancel = useMutation({
    mutationFn: ({ saleId, reason }: { saleId: string; reason?: string }) => shopService.cancel(saleId, reason),
    onSuccess: ({ refund }) => {
      void refresh();
      message.success(refund > 0 ? `Đã hủy đơn, hoàn ${formatVND(refund)} về ví` : 'Đã hủy đơn');
    },
    onError: (error) => message.error(toApiError(error).message),
  });

  return { pickup, cancel };
}
