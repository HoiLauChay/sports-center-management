import {
  BANK_TRANSACTION_STATUSES,
  type BankTransaction,
  type BankTransactionStatus,
  type ReconciliationDay,
} from '@sports-center/shared';
import { Alert, Card, DatePicker, Segmented, Table, Tabs, Tag, type TableColumnsType } from 'antd';
import type { Dayjs } from 'dayjs';
import { useState } from 'react';
import { DataTable } from '~/components/data/DataTable';
import { RowActions } from '~/components/data/RowActions';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { SearchInput } from '~/components/form/SearchInput';
import { Highlight } from '~/components/ui/Highlight';
import { PageHeader } from '~/components/ui/PageHeader';
import { formatDate, formatDateTime, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { DEFAULT_PAGE_SIZE } from '~/lib/search';
import { DATE_FORMAT, formatDayLabel, nowVN } from '~/lib/time';
import { useBankTransactions, useReconciliation } from '../hooks/useBankTransactions';
import { BANK_TX_STATUS_TAG, INVOICE_PURPOSE_LABEL } from '../types';
import { IgnoreModal, ResolveModal } from './ResolveModals';

type StatusFilter = BankTransactionStatus | 'ALL';

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
      render: (value: number) => <span className="whitespace-nowrap tabular-nums">{formatVND(value)}</span>,
    },
    {
      title: 'Nội dung chuyển khoản',
      key: 'content',
      render: (_, transaction) => (
        <div className="flex max-w-xs min-w-44 flex-col gap-0.5">
          <span className="[overflow-wrap:anywhere]">
            <Highlight keyword={q}>{transaction.content}</Highlight>
          </span>
          <span className="text-[14.5px] text-sc-muted-2">
            {transaction.paymentCode ? (
              <>
                <Highlight keyword={q}>{`Mã ${transaction.paymentCode}`}</Highlight>
                {' · '}
              </>
            ) : (
              ''
            )}
            {transaction.referenceCode ? (
              <Highlight keyword={q}>{transaction.referenceCode}</Highlight>
            ) : transaction.sepayId ? (
              `SePay #${transaction.sepayId}`
            ) : (
              ''
            )}
          </span>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (value: BankTransactionStatus) => (
        <Tag color={BANK_TX_STATUS_TAG[value].color} className="!m-0">
          {BANK_TX_STATUS_TAG[value].label}
        </Tag>
      ),
    },
    {
      title: 'Thành viên / ghi chú',
      key: 'handled',
      render: (_, transaction) => {
        const { invoice } = transaction;
        const member = invoice?.account ?? transaction.resolvedAccount;
        if (!member && !invoice && !transaction.note) return <span className="text-sc-muted-2">—</span>;
        return (
          <div className="flex max-w-xs flex-col gap-0.5 text-[14.5px]">
            {member ? (
              <span className="font-medium">{member.fullName}</span>
            ) : (
              invoice && <span className="font-medium">Khách vãng lai</span>
            )}
            {invoice && <span className="text-[14.5px] text-sc-muted">{INVOICE_PURPOSE_LABEL[invoice.purpose]}</span>}
            {transaction.note && <span className="text-sc-muted [overflow-wrap:anywhere]">{transaction.note}</span>}
            {transaction.handledBy && (
              <span className="text-[14.5px] text-sc-muted-2">
                {transaction.handledBy.fullName}
                {transaction.handledAt ? ` · ${formatDateTime(transaction.handledAt)}` : ''}
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, transaction) => (
        <RowActions
          label="Thao tác với giao dịch"
          actions={
            transaction.status === 'UNMATCHED'
              ? [
                  { key: 'resolve', label: 'Xử lý', primary: true, onClick: () => setResolving(transaction) },
                  { key: 'ignore', label: 'Bỏ qua', onClick: () => setIgnoring(transaction) },
                ]
              : []
          }
        />
      ),
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
            ...BANK_TRANSACTION_STATUSES.filter((value) => value !== 'UNMATCHED').map((value) => ({
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
        <SearchInput
          placeholder="Nội dung, mã thanh toán hoặc mã tham chiếu..."
          maxLength={100}
          className="w-full sm:!w-64"
          value={q}
          onChange={(value) => {
            setQ(value);
            reset();
          }}
          loading={transactions.isFetching}
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
      render: (date: string) => <span className="whitespace-nowrap font-semibold">{formatDayLabel(date)}</span>,
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
          <span className="whitespace-nowrap font-medium text-sc-error tabular-nums">
            {count ? `${count > 0 ? '+' : ''}${count} giao dịch · ` : ''}
            {amount > 0 ? '+' : ''}
            {formatVND(amount)}
          </span>
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
          {day.missingReferenceCodes.length > 0 && (
            <span className="text-[14.5px] text-sc-muted">
              Chưa ghi nhận: {day.missingReferenceCodes.join(', ')} (job đồng bộ sẽ bổ sung)
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
          maxDate={nowVN()}
          disabledDate={(current, info) => {
            if (!info.from) return current.isAfter(nowVN(), 'day');
            return Math.abs(current.diff(info.from, 'day')) >= 31 || current.isAfter(nowVN(), 'day');
          }}
          onChange={(value) => value?.[0] && value[1] && setRange([value[0], value[1]])}
        />
        <span className="text-[14.5px] text-sc-muted">
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

export function BankTransactionsPage() {
  return (
    <>
      <PageHeader title="Giao dịch ngân hàng" />
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
