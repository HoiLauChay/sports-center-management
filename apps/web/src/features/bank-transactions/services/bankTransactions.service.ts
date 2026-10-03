import type { Account } from '@sports-center/shared';
import { usersService } from '~/features/users/services/users.service';
import { walletService } from '~/features/wallet/services/wallet.service';
import { mockRequest } from '~/lib/mock/errors';
import { walletLedger } from '~/lib/mock/ledger';
import { bankDb } from '../mocks/bankTransactions';
import type { IgnoreBankTransactionBody, ListBankTransactionsQuery, ResolveBankTransactionBody } from '../types';

const personOf = (user: Pick<Account, 'id' | 'fullName'>) => ({ id: user.id, fullName: user.fullName });

/**
 * Bank transactions and reconciliation (`/bank-transactions`, manager). Mock until #136 ships; members are searched
 * through the real users API and, once assigned, the amount is credited to the member's wallet (mock ledger).
 */
export const bankTransactionsService = {
  list: (query: ListBankTransactionsQuery) => mockRequest(() => bankDb.list(query), 180),

  resolve: (manager: Account, id: string, body: ResolveBankTransactionBody) =>
    mockRequest(async () => {
      const transaction = bankDb.get(id);
      const member = await usersService.get(body.accountId);
      const balance = await walletService.balanceOfMember(member.id);
      const updated = bankDb.resolve(id, { id: member.id, fullName: member.fullName }, body.note, personOf(manager));
      walletLedger.record({
        accountId: member.id,
        serverBalance: balance - walletLedger.delta(member.id),
        type: 'TOP_UP',
        amount: transaction.amount,
        source: 'BANK_TRANSFER',
        method: 'TRANSFER',
        createdBy: personOf(manager),
        description: `Quản lý gán giao dịch ngân hàng ${transaction.referenceCode ?? transaction.sepayId}`,
        idempotencyKey: `resolve:${id}`,
      });
      return updated;
    }, 350),

  ignore: (manager: Account, id: string, body: IgnoreBankTransactionBody) =>
    mockRequest(() => bankDb.ignore(id, body, personOf(manager)), 250),

  reconciliation: (from: string, to: string) => mockRequest(() => bankDb.reconcile(from, to), 350),
};
