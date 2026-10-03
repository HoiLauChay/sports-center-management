import {
  Alert,
  Button,
  Card,
  DatePicker,
  Input,
  Segmented,
  Space,
  Table,
  Tabs,
  Tag,
  type TableColumnsType,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { DataTable } from '~/components/data/DataTable';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { formatDate, formatDateTime, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { DEFAULT_PAGE_SIZE } from '~/lib/search';
import { DATE_FORMAT, formatDayLabel, nowVN } from '~/lib/time';
import { useBankTransactions, useReconciliation } from '../hooks/useBankTransactions';
import {
  BANK_TX_STATUSES,
  BANK_TX_STATUS_TAG,
  type BankTransaction,
  type BankTxStatus,
  type ReconciliationDay,
} from '../types';
import { IgnoreModal, ResolveModal } from './ResolveModals';

type StatusFilter = BankTxStatus | 'ALL';

function TransactionsTab() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [status, setStatus] = useState<StatusFilter>('UNMATCHED');
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [q, setQ] = useState('');
  const [resolving, setResolving] = useState<BankTransaction | null>(null);
  const [ignoring, setIgnoring] = useState<BankTransaction | null>(null);

  const transactions = useBankTransactions({
    page,
    limit,
    status: status === 'ALL' ? undefined : status,
    from: range?.[0]?.format(DATE_FORMAT),
    to: range?.[1]?.format(DATE_FORMAT),
    q: q || undefined,
  });
  const reset = () => setPage(1);

  const columns: TableColumnsType<BankTransaction> = [
    {
      title: 'Thời gian',
      dataIndex: 'transactionDate',
      render: (value: string) => <span className="whitespace-nowrap">{formatDateTime(value)}</span>,
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      align: 'right',
      render: (value: number) => <b className="whitespace-nowrap tabular-nums">{formatVND(value)}</b>,
    },
    {
      title: 'Nội dung chuyển khoản',
      key: 'content',
      render: (_, transaction) => (
        <div className="flex max-w-xs min-w-44 flex-col gap-0.5">
          <span className="[overflow-wrap:anywhere]">{transaction.content}</span>
          <span className="text-xs text-sc-muted-2">
            {transaction.paymentCode ? `Mã ${transaction.paymentCode} · ` : ''}
            {transaction.referenceCode ?? `SePay #${transaction.sepayId}`}
          </span>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (value: BankTxStatus) => (
        <Tag color={BANK_TX_STATUS_TAG[value].color} className="!m-0">
          {BANK_TX_STATUS_TAG[value].label}
        </Tag>
      ),
    },
    {
      title: 'Thành viên / ghi chú',
      key: 'handled',
      render: (_, transaction) => {
        const member = transaction.topUp?.account ?? transaction.resolvedAccount;
        if (!member && !transaction.note) return <span className="text-sc-muted-2">—</span>;
        return (
          <div className="flex max-w-xs flex-col gap-0.5 text-[13px]">
            {member && <b>{member.fullName}</b>}
            {transaction.note && <span className="text-sc-muted [overflow-wrap:anywhere]">{transaction.note}</span>}
            {transaction.handledBy && (
              <span className="text-xs text-sc-muted-2">
                {transaction.handledBy.fullName}
                {transaction.handledAt ? ` · ${formatDateTime(transaction.handledAt)}` : ''}
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, transaction) =>
        transaction.status === 'UNMATCHED' ? (
          <Space>
            <Button size="small" type="primary" onClick={() => setResolving(transaction)}>
              Gán thành viên
            </Button>
            <Button size="small" onClick={() => setIgnoring(transaction)}>
              Bỏ qua
            </Button>
          </Space>
        ) : null,
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={status}
          onChange={(value) => {
            setStatus(value as StatusFilter);
            reset();
          }}
          options={[
            { value: 'UNMATCHED', label: BANK_TX_STATUS_TAG.UNMATCHED.label },
            { value: 'ALL', label: 'Tất cả' },
            ...BANK_TX_STATUSES.filter((value) => value !== 'UNMATCHED').map((value) => ({
              value,
              label: BANK_TX_STATUS_TAG[value].label,
            })),
          ]}
        />
        <DatePicker.RangePicker
          format="DD/MM/YYYY"
          onChange={(value) => {
            setRange(value);
            reset();
          }}
        />
        <Input.Search
          allowClear
          placeholder="Nội dung hoặc mã tham chiếu"
          className="w-full sm:!w-64"
          onSearch={(value) => {
            setQ(value.trim());
            reset();
          }}
        />
      </div>
      <DataTable<BankTransaction>
        columns={columns}
        data={transactions.data}
        isLoading={transactions.isFetching}
        error={transactions.error}
        onRetry={() => void transactions.refetch()}
        page={page}
        limit={limit}
        onPageChange={(nextPage, nextLimit) => {
          setPage(nextLimit === limit ? nextPage : 1);
          setLimit(nextLimit);
        }}
        emptyTitle={status === 'UNMATCHED' ? 'Không còn giao dịch chưa khớp' : 'Không có giao dịch phù hợp'}
        emptyDescription={status === 'UNMATCHED' ? 'Mọi giao dịch tiền vào đều đã được xử lý.' : undefined}
      />
      <ResolveModal transaction={resolving} onClose={() => setResolving(null)} />
      <IgnoreModal transaction={ignoring} onClose={() => setIgnoring(null)} />
    </>
  );
}

function ReconciliationTab() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([nowVN().subtract(6, 'day'), nowVN()]);
  const params = { from: range[0].format(DATE_FORMAT), to: range[1].format(DATE_FORMAT) };
  const reconciliation = useReconciliation(params);

  const columns: TableColumnsType<ReconciliationDay> = [
    {
      title: 'Ngày',
      dataIndex: 'date',
      render: (date: string) => <b className="whitespace-nowrap">{formatDayLabel(date)}</b>,
    },
    {
      title: 'SePay',
      key: 'sepay',
      align: 'right',
      render: (_, day) => (
        <span className="whitespace-nowrap tabular-nums">
          {day.sepay.count} giao dịch · {formatVND(day.sepay.amount)}
        </span>
      ),
    },
    {
      title: 'Hệ thống',
      key: 'system',
      align: 'right',
      render: (_, day) => (
        <span className="whitespace-nowrap tabular-nums">
          {day.system.count} giao dịch · {formatVND(day.system.amount)}
        </span>
      ),
    },
    {
      title: 'Chênh lệch',
      key: 'diff',
      align: 'right',
      render: (_, day) => {
        const amount = day.sepay.amount - day.system.amount;
        const count = day.sepay.count - day.system.count;
        return amount || count ? (
          <b className="whitespace-nowrap text-sc-error tabular-nums">
            {count > 0 ? `+${count} giao dịch · ` : ''}
            {amount > 0 ? '+' : ''}
            {formatVND(amount)}
          </b>
        ) : (
          <span className="text-sc-muted-2">—</span>
        );
      },
    },
    {
      title: 'Kết quả',
      key: 'matched',
      render: (_, day) => (
        <div className="flex flex-col items-start gap-0.5">
          <Tag color={day.matched ? 'success' : 'error'} className="!m-0">
            {day.matched ? 'Khớp' : 'Lệch'}
          </Tag>
          {day.missingSepayIds.length > 0 && (
            <span className="text-xs text-sc-muted">
              Chưa ghi nhận: SePay #{day.missingSepayIds.join(', #')} (job đồng bộ sẽ bổ sung)
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <DatePicker.RangePicker
          allowClear={false}
          format="DD/MM/YYYY"
          value={range}
          maxDate={dayjs()}
          disabledDate={(current, info) => {
            if (!info.from) return current.isAfter(dayjs(), 'day');
            return Math.abs(current.diff(info.from, 'day')) >= 31 || current.isAfter(dayjs(), 'day');
          }}
          onChange={(value) => value?.[0] && value[1] && setRange([value[0], value[1]])}
        />
        <span className="text-[13px] text-sc-muted">
          So tổng tiền vào theo ngày (giờ VN) giữa SePay và hệ thống · tối đa 31 ngày.
        </span>
      </div>
      {reconciliation.isError ? (
        <ErrorState
          message={
            toApiError(reconciliation.error).code === 'UPSTREAM_UNAVAILABLE'
              ? 'Không lấy được số liệu từ SePay lúc này (lỗi hoặc quá giới hạn tần suất). Vui lòng thử lại sau ít phút.'
              : toApiError(reconciliation.error).message
          }
          onRetry={() => void reconciliation.refetch()}
        />
      ) : (
        <Table<ReconciliationDay>
          rowKey="date"
          columns={columns}
          dataSource={reconciliation.data?.days}
          loading={reconciliation.isFetching}
          pagination={false}
          scroll={{ x: 'max-content' }}
          rowClassName={(day) => (day.matched ? '' : 'bg-[#fdf1ef]')}
          locale={{ emptyText: reconciliation.isFetching ? ' ' : <EmptyState title="Chưa có dữ liệu đối soát" /> }}
          summary={(days) => {
            const mismatched = days.filter((day) => !day.matched).length;
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5}>
                  {mismatched ? (
                    <b className="text-sc-error">{mismatched} ngày lệch cần kiểm tra</b>
                  ) : (
                    <b className="text-sc-success">Tất cả các ngày đều khớp</b>
                  )}
                </Table.Summary.Cell>
              </Table.Summary.Row>
            );
          }}
        />
      )}
      <Alert
        type="info"
        showIcon
        className="!mt-4"
        title={`Khoảng đối soát hiện tại: ${formatDate(params.from)} – ${formatDate(params.to)}. Ngày lệch được tô màu.`}
      />
    </>
  );
}

/** `/admin/bank-transactions`: incoming SePay transactions, unmatched ones to assign or ignore, daily reconciliation. */
export function BankTransactionsPage() {
  return (
    <>
      <PageHeader
        title="Giao dịch ngân hàng"
        description="Tiền vào từ SePay. Giao dịch không tự khớp cần Manager gán cho thành viên hoặc bỏ qua kèm ghi chú."
      />
      <Card>
        <Tabs
          items={[
            { key: 'transactions', label: 'Giao dịch', children: <TransactionsTab /> },
            { key: 'reconciliation', label: 'Đối soát theo ngày', children: <ReconciliationTab /> },
          ]}
        />
      </Card>
    </>
  );
}
