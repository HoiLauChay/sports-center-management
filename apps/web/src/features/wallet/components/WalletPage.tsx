import {
  INVOICE_STATUSES,
  WALLET_TRANSACTION_TYPES,
  type Invoice,
  type WalletTransactionType,
} from '@sports-center/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button, Card, Segmented, Select, Tabs, type TableColumnsType } from 'antd';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { DataTable } from '~/components/data/DataTable';
import { MappedTag } from '~/components/ui/MappedTag';
import { PageHeader } from '~/components/ui/PageHeader';
import { WalletCard } from '~/components/ui/WalletCard';
import { INVOICE_STATUS_TAG, WALLET_TX_TAG, invoiceStatusOf } from '~/constants/payment';
import { formatDateTime, formatVND } from '~/lib/format';
import { DEFAULT_PAGE_SIZE } from '~/lib/search';
import { useMyWallet } from '../hooks/useWallet';
import { walletService } from '../services/wallet.service';
import { WalletTransactionsTable } from './WalletTransactionsTable';

const invoiceColumns: TableColumnsType<Invoice> = [
  {
    title: 'Mã thanh toán',
    dataIndex: 'paymentCode',
    render: (code: string) => <span className="font-mono text-[13px] font-semibold">{code}</span>,
  },
  {
    title: 'Số tiền',
    dataIndex: 'amount',
    align: 'right',
    render: (amount: number) => <b className="whitespace-nowrap tabular-nums">{formatVND(amount)}</b>,
  },
  {
    title: 'Trạng thái',
    key: 'status',
    render: (_, invoice) => <MappedTag value={invoiceStatusOf(invoice)} map={INVOICE_STATUS_TAG} />,
  },
  {
    title: 'Tạo lúc',
    dataIndex: 'createdAt',
    render: (value: string) => <span className="whitespace-nowrap">{formatDateTime(value)}</span>,
  },
  {
    title: 'Thanh toán lúc',
    dataIndex: 'paidAt',
    render: (value: string | null) =>
      value ? <span className="whitespace-nowrap">{formatDateTime(value)}</span> : '—',
  },
  {
    title: '',
    key: 'actions',
    align: 'right',
    render: (_, invoice) => {
      const pending = invoiceStatusOf(invoice) === 'PENDING';
      return (
        <Link to="/invoices/$invoiceId" params={{ invoiceId: invoice.id }}>
          <Button size="small" type={pending ? 'primary' : 'default'}>
            {pending ? 'Thanh toán' : 'Chi tiết'}
          </Button>
        </Link>
      );
    },
  },
];

function TransactionsTab() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [type, setType] = useState<WalletTransactionType | undefined>();
  const wallet = useMyWallet({ page, limit, type });

  return (
    <>
      <Segmented
        className="mb-4"
        value={type ?? 'ALL'}
        onChange={(value) => {
          setType(value === 'ALL' ? undefined : (value as WalletTransactionType));
          setPage(1);
        }}
        options={[
          { value: 'ALL', label: 'Tất cả' },
          ...WALLET_TRANSACTION_TYPES.map((value) => ({ value, label: WALLET_TX_TAG[value].label })),
        ]}
      />
      <WalletTransactionsTable
        data={wallet.data?.transactions}
        isLoading={wallet.isFetching}
        error={wallet.error}
        onRetry={() => void wallet.refetch()}
        page={page}
        limit={limit}
        onPageChange={(nextPage, nextLimit) => {
          setPage(nextLimit === limit ? nextPage : 1);
          setLimit(nextLimit);
        }}
      />
    </>
  );
}

function TopUpInvoicesTab() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [status, setStatus] = useState<Invoice['status'] | undefined>();
  const invoices = useQuery({
    queryKey: ['invoices', 'mine', { page, limit, status }],
    queryFn: () => walletService.listInvoices({ page, limit, purpose: 'WALLET_TOP_UP', status }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <Select
        allowClear
        placeholder="Mọi trạng thái"
        className="mb-4 w-full sm:!w-56"
        value={status}
        onChange={(value: Invoice['status'] | undefined) => {
          setStatus(value);
          setPage(1);
        }}
        options={INVOICE_STATUSES.map((value) => ({ value, label: INVOICE_STATUS_TAG[value].label }))}
      />
      <DataTable<Invoice>
        columns={invoiceColumns}
        data={invoices.data}
        isLoading={invoices.isFetching}
        error={invoices.error}
        onRetry={() => void invoices.refetch()}
        page={page}
        limit={limit}
        onPageChange={(nextPage, nextLimit) => {
          setPage(nextLimit === limit ? nextPage : 1);
          setLimit(nextLimit);
        }}
        emptyTitle="Chưa có hóa đơn nạp ví"
        emptyDescription="Mỗi lần bạn tạo yêu cầu nạp tiền sẽ có một hóa đơn."
      />
    </>
  );
}

export function WalletPage() {
  const balance = useMyWallet({ page: 1, limit: 1 });

  return (
    <>
      <PageHeader
        title="Ví của tôi"
        description="Mua dịch vụ trực tuyến chỉ thanh toán bằng ví. Ví chỉ nạp, thanh toán và hoàn tiền, không rút."
        extra={
          <Link to="/wallet/top-up">
            <Button type="primary" icon={<Plus size={16} />}>
              Nạp tiền
            </Button>
          </Link>
        }
      />
      <div className="mb-4 max-w-md">
        <WalletCard
          balance={balance.data?.balance ?? 0}
          description={balance.isPending ? 'Đang tải số dư…' : 'Số dư khả dụng để thanh toán đơn hàng'}
        />
      </div>
      <Card>
        <Tabs
          items={[
            { key: 'transactions', label: 'Lịch sử giao dịch', children: <TransactionsTab /> },
            { key: 'invoices', label: 'Hóa đơn nạp ví', children: <TopUpInvoicesTab /> },
          ]}
        />
      </Card>
    </>
  );
}
