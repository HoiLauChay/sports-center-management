import type { Paginated, Person } from '@sports-center/shared';
import { MockApiError, mockErrors } from '~/lib/mock/errors';
import { createMockStore, newId, nowIso } from '~/lib/mock/store';
import { addDays, nowVN, parseDate, todayVN, vnDate } from '~/lib/time';
import type {
  BankTransaction,
  BankTxStatus,
  IgnoreBankTransactionBody,
  ListBankTransactionsQuery,
  Reconciliation,
  ReconciliationDay,
} from '../types';

interface MissingSepayTx {
  sepayId: number;
  date: string;
  amount: number;
}

interface BankState {
  transactions: BankTransaction[];
  /** Transactions SePay reports but the system has not recorded yet (what the reconciliation flags). */
  missing: MissingSepayTx[];
}

const BANK = { bankName: 'MBBank', accountNumber: '0123456789' };

function seed(): BankState {
  let sepayId = 48_210;
  const at = (daysAgo: number, hour: number, minute: number) =>
    nowVN().subtract(daysAgo, 'day').hour(hour).minute(minute).second(0).toISOString();
  const tx = (
    daysAgo: number,
    hour: number,
    minute: number,
    amount: number,
    content: string,
    status: BankTxStatus,
    extra: Partial<BankTransaction> = {},
  ): BankTransaction => {
    sepayId += 1;
    const code = /SCTU[A-Z0-9]{8}/.exec(content)?.[0] ?? null;
    return {
      id: newId(),
      sepayId,
      ...BANK,
      amount,
      content,
      paymentCode: code,
      referenceCode: `FT${26000000 + sepayId}`,
      transactionDate: at(daysAgo, hour, minute),
      status,
      topUp: null,
      resolvedAccount: null,
      handledBy: null,
      handledAt: null,
      note: null,
      ...extra,
    };
  };
  const member = (fullName: string): Person => ({ id: newId(), fullName });
  const manager: Person = { id: newId(), fullName: 'Quản lý' };

  return {
    transactions: [
      tx(0, 9, 14, 500_000, 'NGUYEN VAN A CHUYEN TIEN', 'UNMATCHED'),
      tx(0, 8, 2, 200_000, 'SCTUK7M2Q9XP nap vi', 'UNMATCHED'),
      tx(1, 18, 40, 1_000_000, 'MBVCB.123 sctu9aaa1111 nap tien', 'UNMATCHED'),
      tx(1, 15, 5, 350_000, 'Tra tien san cau long', 'UNMATCHED'),
      tx(2, 11, 20, 500_000, 'SCTUH4N8R2LC', 'MATCHED', { topUp: { id: newId(), account: member('Nguyễn Minh Anh') } }),
      tx(2, 10, 45, 300_000, 'SCTUB6D3W7TY', 'MATCHED', { topUp: { id: newId(), account: member('Trần Quốc Bảo') } }),
      tx(3, 20, 10, 2_000_000, 'SCTUZ5F2K8NM', 'MATCHED', { topUp: { id: newId(), account: member('Lê Thu Hà') } }),
      tx(3, 14, 30, 250_000, 'CK hoc phi yoga', 'RESOLVED', {
        resolvedAccount: member('Phạm Gia Hân'),
        handledBy: manager,
        handledAt: at(2, 9, 0),
        note: 'Khách báo chuyển nhầm nội dung, đã xác minh qua SĐT.',
      }),
      tx(4, 19, 25, 100_000, 'Chuyen khoan linh tinh', 'IGNORED', {
        handledBy: manager,
        handledAt: at(3, 8, 30),
        note: 'Không xác định được người chuyển, không có yêu cầu nạp tương ứng.',
      }),
      tx(5, 9, 50, 800_000, 'SCTUJ3P9L6QV', 'MATCHED', { topUp: { id: newId(), account: member('Đỗ Hoàng Nam') } }),
      tx(6, 16, 15, 450_000, 'SCTUC8V4X1RE', 'MATCHED', { topUp: { id: newId(), account: member('Võ Thanh Tâm') } }),
    ],
    missing: [
      { sepayId: 49_001, date: addDays(todayVN(), -2), amount: 150_000 },
      { sepayId: 49_002, date: addDays(todayVN(), -4), amount: 600_000 },
    ],
  };
}

const store = createMockStore<BankState>('sc_mock_bank_v1', seed);

export const bankDb = {
  list(query: ListBankTransactionsQuery): Paginated<BankTransaction> {
    const term = query.q?.trim().toLowerCase();
    const rows = store
      .get()
      .transactions.filter((entry) => {
        if (query.status && entry.status !== query.status) return false;
        const day = vnDate(entry.transactionDate);
        if (query.from && day < query.from) return false;
        if (query.to && day > query.to) return false;
        if (term && !`${entry.content} ${entry.referenceCode ?? ''}`.toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
    const start = (query.page - 1) * query.limit;
    return { items: rows.slice(start, start + query.limit), page: query.page, limit: query.limit, total: rows.length };
  },

  countUnmatched: () => store.get().transactions.filter((entry) => entry.status === 'UNMATCHED').length,

  /** Marks the transaction as assigned to a member; the caller credits the wallet. */
  resolve(id: string, account: Person, note: string, actor: Person): BankTransaction {
    return store.update((state) => {
      const entry = state.transactions.find((candidate) => candidate.id === id);
      if (!entry) throw mockErrors.notFound('Không tìm thấy giao dịch');
      if (entry.status !== 'UNMATCHED') {
        throw mockErrors.conflict('INVALID_STATE', 'Chỉ gán được giao dịch chưa khớp');
      }
      entry.status = 'RESOLVED';
      entry.resolvedAccount = account;
      entry.handledBy = actor;
      entry.handledAt = nowIso();
      entry.note = note.trim();
      return entry;
    });
  },

  ignore(id: string, body: IgnoreBankTransactionBody, actor: Person): BankTransaction {
    return store.update((state) => {
      const entry = state.transactions.find((candidate) => candidate.id === id);
      if (!entry) throw mockErrors.notFound('Không tìm thấy giao dịch');
      if (entry.status !== 'UNMATCHED') {
        throw mockErrors.conflict('INVALID_STATE', 'Chỉ bỏ qua được giao dịch chưa khớp');
      }
      entry.status = 'IGNORED';
      entry.handledBy = actor;
      entry.handledAt = nowIso();
      entry.note = body.note.trim();
      return entry;
    });
  },

  get(id: string): BankTransaction {
    const entry = store.get().transactions.find((candidate) => candidate.id === id);
    if (!entry) throw mockErrors.notFound('Không tìm thấy giao dịch');
    return entry;
  },

  /** `GET /bank-transactions/reconciliation`: SePay totals per day against what the system has recorded. */
  reconcile(from: string, to: string): Reconciliation {
    const span = parseDate(to).diff(parseDate(from), 'day');
    if (span < 0) throw mockErrors.invalid('query.to', 'Ngày kết thúc phải sau ngày bắt đầu');
    if (span > 30) throw mockErrors.invalid('query.to', 'Khoảng đối soát tối đa 31 ngày');
    if (parseDate(to).isAfter(parseDate(todayVN()))) {
      throw new MockApiError(503, 'UPSTREAM_UNAVAILABLE', 'Không đối soát được ngày chưa diễn ra.');
    }

    const { transactions, missing } = store.get();
    const days: ReconciliationDay[] = [];
    for (let offset = 0; offset <= span; offset += 1) {
      const date = addDays(from, offset);
      const recorded = transactions.filter((entry) => vnDate(entry.transactionDate) === date);
      const absent = missing.filter((entry) => entry.date === date);
      const system = { count: recorded.length, amount: recorded.reduce((sum, entry) => sum + entry.amount, 0) };
      const sepay = {
        count: system.count + absent.length,
        amount: system.amount + absent.reduce((sum, entry) => sum + entry.amount, 0),
      };
      days.push({
        date,
        sepay,
        system,
        matched: sepay.count === system.count && sepay.amount === system.amount,
        missingSepayIds: absent.map((entry) => entry.sepayId),
      });
    }
    return { days };
  },
};
