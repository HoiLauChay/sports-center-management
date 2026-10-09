import type { Account, Invoice, WalletTransaction } from '@sports-center/shared';
import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { checkoutService } from '../src/features/checkout/services/checkout.service';
import { counterDraftStore } from '../src/features/checkout/store/cartStore';
import type { CheckoutRequest } from '../src/features/checkout/types';
import { walletService } from '../src/features/wallet/services/wallet.service';
import { privateApi } from '../src/lib/http';

describe('counterDraftStore (sessionStorage, Issue #134)', () => {
  const staffId = '00000000-0000-0000-0000-000000000099';
  const store = counterDraftStore(staffId);

  beforeEach(() => {
    store.reset();
  });

  it('manages buyer and cart lines for counter order', () => {
    store.setBuyer({ kind: 'MEMBER', accountId: 'member-1', fullName: 'Nguyen Van A', phone: '0901234567' });
    expect(store.getSnapshot().buyer?.kind).toBe('MEMBER');

    store.add({ type: 'COURSE_ENROLLMENT', classId: '00000000-0000-0000-0000-000000000101' });
    expect(store.getSnapshot().lines.length).toBe(1);

    // Switching buyer resets the draft to prevent mixed services
    store.setBuyer({ kind: 'GUEST', name: 'Khach Vang Lai', phone: '0988888888' });
    expect(store.getSnapshot().buyer?.kind).toBe('GUEST');
    expect(store.getSnapshot().lines.length).toBe(0);
  });
});

describe('Reception counter invoice & top-up APIs (Issue #134)', () => {
  const staffUser: Account = {
    id: '00000000-0000-0000-0000-000000000099',
    email: 'receptionist@test.com',
    fullName: 'Test Receptionist',
    role: 'RECEPTIONIST',
    status: 'ACTIVE',
    phone: null,
    avatarUrl: null,
    gender: 'OTHER',
    dateOfBirth: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('calls POST /checkout/invoices on startCounterTransfer', async () => {
    const request: CheckoutRequest = {
      buyer: { guest: { name: 'Guest A', phone: '0901234567' } },
      items: [{ type: 'COURSE_ENROLLMENT', classId: '00000000-0000-0000-0000-000000000101' }],
      expectedTotal: 500_000,
      paymentMethod: 'TRANSFER',
      idempotencyKey: 'idemp-inv-12345',
    };
    const mockInvoice: Partial<Invoice> = {
      id: 'inv-uuid-1',
      invoiceNumber: 'INV-001',
      amount: 500_000,
      status: 'PENDING',
    };

    const postSpy = spyOn(privateApi, 'post').mockResolvedValue({
      data: { status: true, result: mockInvoice },
    } as never);

    const result = await checkoutService.startCounterTransfer(staffUser, request);
    expect(postSpy).toHaveBeenCalledWith('/checkout/invoices', {
      buyer: request.buyer,
      items: request.items,
      expectedTotal: 500_000,
      couponCode: undefined,
    });
    expect(result).toBe(mockInvoice as never);
    postSpy.mockRestore();
  });

  it('calls GET /invoices/:id on getCounterInvoice', async () => {
    const invoiceId = '00000000-0000-0000-0000-000000000050';
    const mockInvoice: Partial<Invoice> = { id: invoiceId, status: 'PENDING' };

    const getSpy = spyOn(privateApi, 'get').mockResolvedValue({
      data: { status: true, result: mockInvoice },
    } as never);

    const result = await checkoutService.getCounterInvoice(staffUser, invoiceId);
    expect(getSpy).toHaveBeenCalledWith(`/invoices/${invoiceId}`);
    expect(result).toBe(mockInvoice as never);
    getSpy.mockRestore();
  });

  it('calls POST /invoices/:id/cancel on cancelCounterInvoice', async () => {
    const invoiceId = '00000000-0000-0000-0000-000000000050';
    const mockCancelled: Partial<Invoice> = { id: invoiceId, status: 'CANCELLED' };

    const postSpy = spyOn(privateApi, 'post').mockResolvedValue({
      data: { status: true, result: mockCancelled },
    } as never);

    const result = await checkoutService.cancelCounterInvoice(invoiceId);
    expect(postSpy).toHaveBeenCalledWith(`/invoices/${invoiceId}/cancel`);
    expect(result).toBe(mockCancelled as never);
    postSpy.mockRestore();
  });

  it('calls POST /users/:id/wallet/top-ups on counterTopUp (Cash/Card)', async () => {
    const memberId = '00000000-0000-0000-0000-000000000001';
    const topUpInput = {
      amount: 200_000,
      method: 'CASH' as const,
      note: 'Khach nap tien mat tai quay',
      idempotencyKey: 'idemp-topup-9999',
    };
    const mockTx: Partial<WalletTransaction> = {
      id: 'tx-uuid-1',
      amount: 200_000,
      method: 'CASH',
      type: 'TOP_UP',
    };

    const postSpy = spyOn(privateApi, 'post').mockResolvedValue({
      data: { status: true, result: mockTx },
    } as never);

    const result = await walletService.counterTopUp(
      memberId,
      { id: staffUser.id, fullName: staffUser.fullName },
      topUpInput,
    );

    expect(postSpy).toHaveBeenCalledWith(`/users/${memberId}/wallet/top-ups`, {
      amount: 200_000,
      method: 'CASH',
      note: 'Khach nap tien mat tai quay',
      idempotencyKey: 'idemp-topup-9999',
    });
    expect(result).toBe(mockTx as never);
    postSpy.mockRestore();
  });
});
