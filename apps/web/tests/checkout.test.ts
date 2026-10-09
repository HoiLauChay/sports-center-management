import type { Account } from '@sports-center/shared';
import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { checkoutService } from '../src/features/checkout/services/checkout.service';
import { memberCartStore } from '../src/features/checkout/store/cartStore';
import type { CheckoutRequest, Order, Quote, QuoteRequest } from '../src/features/checkout/types';
import { privateApi } from '../src/lib/http';

describe('cartStore (localStorage)', () => {
  const memberId = '00000000-0000-0000-0000-000000000001';
  const store = memberCartStore(memberId);

  beforeEach(() => {
    store.reset();
  });

  it('manages cart lines: add, clear, reset', () => {
    expect(store.getSnapshot().lines.length).toBe(0);

    // Add first line
    store.add({ type: 'COURSE_ENROLLMENT', classId: '00000000-0000-0000-0000-000000000101' });
    expect(store.getSnapshot().lines.length).toBe(1);

    // Set coupon
    store.setCoupon('GIAM10');
    expect(store.getSnapshot().couponCode).toBe('GIAM10');

    // Reset cart clears lines and coupon (Acceptance Criteria #110)
    store.reset();
    expect(store.getSnapshot().lines.length).toBe(0);
    expect(store.getSnapshot().couponCode).toBe('');
  });

  it('removes specific line by key', () => {
    store.add({ type: 'MEMBERSHIP', packageId: '00000000-0000-0000-0000-000000000201' });
    const lineKey = store.getSnapshot().lines[0].key;

    store.remove(lineKey);
    expect(store.getSnapshot().lines.length).toBe(0);
  });
});

describe('checkoutService API endpoints (#110)', () => {
  const mockUser: Account = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'member@test.com',
    fullName: 'Test Member',
    role: 'MEMBER',
    status: 'ACTIVE',
    phone: null,
    avatarUrl: null,
    gender: 'OTHER',
    dateOfBirth: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const mockStaffUser: Account = {
    ...mockUser,
    role: 'RECEPTIONIST',
  };

  it('calls POST /checkout/quote on quote', async () => {
    const quoteReq: QuoteRequest = {
      items: [{ type: 'COURSE_ENROLLMENT', classId: '00000000-0000-0000-0000-000000000101' }],
      couponCode: 'SALE20',
    };
    const mockQuote: Partial<Quote> = {
      subtotal: 500_000,
      total: 400_000,
      couponDiscount: 100_000,
    };

    const postSpy = spyOn(privateApi, 'post').mockResolvedValue({
      data: { status: true, result: mockQuote },
    } as never);

    const result = await checkoutService.quote(mockUser, quoteReq);
    expect(postSpy).toHaveBeenCalledWith('/checkout/quote', {
      buyer: undefined,
      items: quoteReq.items,
      couponCode: 'SALE20',
    });
    expect(result).toBe(mockQuote as never);
    postSpy.mockRestore();
  });

  it('calls POST /checkout on checkout with idempotencyKey', async () => {
    const checkoutReq: CheckoutRequest = {
      items: [{ type: 'COURSE_ENROLLMENT', classId: '00000000-0000-0000-0000-000000000101' }],
      paymentMethod: 'WALLET',
      expectedTotal: 400_000,
      idempotencyKey: 'test-idempotency-key-12345',
    };
    const mockOrder: Partial<Order> = {
      id: 'order-uuid-1',
      orderNumber: 'ORD-20261009-001',
      totalAmount: 400_000,
      status: 'PAID',
    };

    const postSpy = spyOn(privateApi, 'post').mockResolvedValue({
      data: { status: true, result: mockOrder },
    } as never);

    const result = await checkoutService.checkout(mockUser, checkoutReq);
    expect(postSpy).toHaveBeenCalledWith('/checkout', {
      buyer: undefined,
      items: checkoutReq.items,
      couponCode: undefined,
      paymentMethod: 'WALLET',
      expectedTotal: 400_000,
      idempotencyKey: 'test-idempotency-key-12345',
    });
    expect(result).toBe(mockOrder as never);
    postSpy.mockRestore();
  });

  it('calls GET /me/orders for MEMBER in listOrders', async () => {
    const mockOrdersPage = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    const getSpy = spyOn(privateApi, 'get').mockResolvedValue({
      data: { status: true, result: mockOrdersPage },
    } as never);

    const result = await checkoutService.listOrders(mockUser, { page: 1, limit: 10 });
    expect(getSpy).toHaveBeenCalledWith('/me/orders', {
      params: { page: 1, limit: 10, from: undefined, to: undefined },
    });
    expect(result).toBe(mockOrdersPage as never);
    getSpy.mockRestore();
  });

  it('calls GET /orders for RECEPTIONIST / MANAGER in listOrders', async () => {
    const mockOrdersPage = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    const getSpy = spyOn(privateApi, 'get').mockResolvedValue({
      data: { status: true, result: mockOrdersPage },
    } as never);

    const query = { page: 1, limit: 10, status: 'PAID' as const };
    const result = await checkoutService.listOrders(mockStaffUser, query);
    expect(getSpy).toHaveBeenCalledWith('/orders', { params: query });
    expect(result).toBe(mockOrdersPage as never);
    getSpy.mockRestore();
  });

  it('calls GET /orders/:id in getOrder', async () => {
    const orderId = '00000000-0000-0000-0000-000000000001';
    const mockOrder: Partial<Order> = { id: orderId, orderNumber: 'ORD-001' };
    const getSpy = spyOn(privateApi, 'get').mockResolvedValue({
      data: { status: true, result: mockOrder },
    } as never);

    const result = await checkoutService.getOrder(mockUser, orderId);
    expect(getSpy).toHaveBeenCalledWith(`/orders/${orderId}`);
    expect(result).toBe(mockOrder as never);
    getSpy.mockRestore();
  });
});
