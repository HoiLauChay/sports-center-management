import { Alert, Button, Table, Tag, type TableColumnsType } from 'antd';
import { Trash2 } from 'lucide-react';
import { formatVND } from '~/lib/format';
import type { CartLine, Quote, QuoteLine } from '../types';
import { ORDER_ITEM_TYPE_LABEL } from '../types';
import { describeLine } from '../utils';

const BENEFIT_LABEL: Record<string, string> = {
  GYM_ACCESS: 'Gym miễn phí theo gói',
  FREE_SLOT: 'Slot miễn phí theo gói',
  DISCOUNT: 'Giảm giá theo gói',
};

function benefitLabel(item: QuoteLine | undefined) {
  const benefit = item?.snapshot?.benefit;
  return typeof benefit === 'string' ? BENEFIT_LABEL[benefit] : undefined;
}

interface Row {
  line: CartLine;
  item?: QuoteLine;
}

interface QuoteLinesProps {
  lines: CartLine[];
  quote: Quote | undefined;
  /** True while a new quote is on its way (prices shown may be stale). */
  pricing?: boolean;
  onRemove?: (lineKey: string) => void;
  disabled?: boolean;
}

function Money({ value, discount = false }: { value: number; discount?: boolean }) {
  if (!value) return <span className="text-sc-muted-2">—</span>;
  return (
    <span className={`whitespace-nowrap tabular-nums ${discount ? 'text-sc-success' : ''}`}>
      {discount ? '−' : ''}
      {formatVND(value)}
    </span>
  );
}

/** The draft's lines with the server's price breakdown and per-line errors (UC_3.18–3.19). */
export function QuoteLines({ lines, quote, pricing = false, onRemove, disabled }: QuoteLinesProps) {
  const aligned = quote?.items.length === lines.length;
  const rows: Row[] = lines.map((line, index) => ({ line, item: aligned ? quote?.items[index] : undefined }));

  const columns: TableColumnsType<Row> = [
    {
      title: 'Dịch vụ',
      key: 'service',
      render: (_, { line, item }) => {
        const description = item ? describeLine(item.type, item.snapshot ?? {}) : null;
        return (
          <div className="flex min-w-56 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Tag className="!m-0">{ORDER_ITEM_TYPE_LABEL[line.selection.type]}</Tag>
              <b className="[overflow-wrap:anywhere]">{description?.title ?? 'Đang tính giá…'}</b>
            </div>
            {description?.detail && <span className="text-[13px] text-sc-muted">{description.detail}</span>}
            {benefitLabel(item) && <span className="text-xs font-semibold text-sc-success">{benefitLabel(item)}</span>}
            {item && !item.valid && (
              <Alert type="error" showIcon className="!mt-1" title={item.error?.message ?? 'Dịch vụ không hợp lệ'} />
            )}
          </div>
        );
      },
    },
    {
      title: 'Giá gốc',
      key: 'subtotal',
      align: 'right',
      render: (_, { item }) => (item ? <Money value={item.subtotal} /> : '…'),
    },
    {
      title: 'Ưu đãi gói',
      key: 'membership',
      align: 'right',
      render: (_, { item }) => (item ? <Money value={item.membershipDiscount} discount /> : '…'),
    },
    {
      title: 'Mã giảm giá',
      key: 'coupon',
      align: 'right',
      render: (_, { item }) => (item ? <Money value={item.couponDiscount} discount /> : '…'),
    },
    {
      title: 'Thành tiền',
      key: 'total',
      align: 'right',
      render: (_, { item }) =>
        item ? <b className="whitespace-nowrap tabular-nums">{formatVND(item.total)}</b> : <span>…</span>,
    },
    ...(onRemove
      ? [
          {
            title: '',
            key: 'remove',
            width: 56,
            render: (_: unknown, { line }: Row) => (
              <Button
                type="text"
                danger
                disabled={disabled}
                aria-label="Xóa dòng này"
                icon={<Trash2 size={16} />}
                onClick={() => onRemove(line.key)}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <Table<Row>
      rowKey={(row) => row.line.key}
      size="middle"
      columns={columns}
      dataSource={rows}
      pagination={false}
      loading={pricing}
      scroll={{ x: 'max-content' }}
    />
  );
}
