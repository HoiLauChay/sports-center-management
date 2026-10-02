import type { Paginated, WalletTransaction } from '@sports-center/shared';
import type { TableColumnsType } from 'antd';
import { DataTable } from '~/components/data/DataTable';
import { MappedTag } from '~/components/ui/MappedTag';
import { PAYMENT_METHOD_LABEL, WALLET_TX_TAG } from '~/constants/payment';
import { formatDateTime, formatVND } from '~/lib/format';

const SOURCE_LABEL = { BANK_TRANSFER: 'Chuyển khoản', COUNTER: 'Tại quầy' } as const;

function describe(transaction: WalletTransaction) {
  if (transaction.description) return transaction.description;
  if (transaction.type === 'TOP_UP') {
    return transaction.source ? `Nạp ví · ${SOURCE_LABEL[transaction.source]}` : 'Nạp ví';
  }
  return transaction.type === 'PAYMENT' ? 'Thanh toán đơn hàng' : 'Hoàn tiền về ví';
}

const columns: TableColumnsType<WalletTransaction> = [
  {
    title: 'Thời gian',
    dataIndex: 'createdAt',
    render: (value: string) => <span className="whitespace-nowrap">{formatDateTime(value)}</span>,
  },
  {
    title: 'Loại',
    dataIndex: 'type',
    render: (type: WalletTransaction['type']) => <MappedTag value={type} map={WALLET_TX_TAG} />,
  },
  {
    title: 'Nội dung',
    key: 'description',
    render: (_, transaction) => (
      <div className="flex min-w-48 flex-col gap-0.5">
        <span>{describe(transaction)}</span>
        <span className="text-xs text-sc-muted-2">
          {transaction.transactionCode}
          {transaction.method && ` · ${PAYMENT_METHOD_LABEL[transaction.method]}`}
          {transaction.createdBy && ` · ${transaction.createdBy.fullName}`}
        </span>
      </div>
    ),
  },
  {
    title: 'Số tiền',
    key: 'amount',
    align: 'right',
    render: (_, transaction) => (
      <b
        className={`whitespace-nowrap tabular-nums ${transaction.type === 'PAYMENT' ? 'text-sc-error' : 'text-sc-success'}`}
      >
        {transaction.type === 'PAYMENT' ? '−' : '+'}
        {formatVND(transaction.amount)}
      </b>
    ),
  },
  {
    title: 'Số dư sau',
    dataIndex: 'balanceAfter',
    align: 'right',
    render: (value: number) => <span className="whitespace-nowrap tabular-nums">{formatVND(value)}</span>,
  },
];

interface WalletTransactionsTableProps {
  data: Paginated<WalletTransaction> | undefined;
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
  page: number;
  limit: number;
  onPageChange: (page: number, limit: number) => void;
}

export function WalletTransactionsTable(props: WalletTransactionsTableProps) {
  return (
    <DataTable<WalletTransaction>
      columns={columns}
      emptyTitle="Chưa có giao dịch ví"
      emptyDescription="Nạp tiền, thanh toán và hoàn tiền sẽ hiện ở đây."
      {...props}
    />
  );
}
