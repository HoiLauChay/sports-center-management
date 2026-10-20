import type { Paginated, WalletTransaction } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
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
    responsive: ['md'],
    render: (value: string) => <span className="whitespace-nowrap">{formatDateTime(value)}</span>,
  },
  {
    title: 'Loại',
    dataIndex: 'type',
    responsive: ['md'],
    render: (type: WalletTransaction['type']) => <MappedTag value={type} map={WALLET_TX_TAG} />,
  },
  {
    title: 'Nội dung',
    key: 'description',
    render: (_, transaction) => (
      <div className="flex flex-col gap-0.5 md:min-w-48">
        <span className="flex flex-wrap items-center gap-2">
          <span className="md:hidden">
            <MappedTag value={transaction.type} map={WALLET_TX_TAG} />
          </span>
          {describe(transaction)}
        </span>
        <span className="text-[13px] text-sc-muted md:hidden">{formatDateTime(transaction.createdAt)}</span>
        <span className="text-[13px] text-sc-muted-2 [overflow-wrap:anywhere]">
          {transaction.transactionCode}
          {transaction.method && ` · ${PAYMENT_METHOD_LABEL[transaction.method]}`}
          {transaction.createdBy && ` · ${transaction.createdBy.fullName}`}
        </span>
        {transaction.orderId && (
          <Link
            to="/orders/$orderId"
            params={{ orderId: transaction.orderId }}
            className="text-[13px] font-semibold underline underline-offset-2"
          >
            Xem đơn hàng
          </Link>
        )}
      </div>
    ),
  },
  {
    title: 'Số tiền',
    key: 'amount',
    align: 'right',
    render: (_, transaction) => (
      <span
        className={`whitespace-nowrap font-medium tabular-nums ${transaction.type === 'PAYMENT' ? 'text-sc-error' : 'text-sc-success'}`}
      >
        {transaction.type === 'PAYMENT' ? '−' : '+'}
        {formatVND(transaction.amount)}
        <span className="block text-[13px] font-normal text-sc-muted md:hidden">
          Số dư {formatVND(transaction.balanceAfter)}
        </span>
      </span>
    ),
  },
  {
    title: 'Số dư sau',
    dataIndex: 'balanceAfter',
    responsive: ['md'],
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
