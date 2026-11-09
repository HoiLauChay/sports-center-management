import type { ShopReport } from '@sports-center/shared';
import { Card, Progress, Tag, type TableColumnsType } from 'antd';
import { Clock, Coins, Package, Receipt } from 'lucide-react';
import { useState } from 'react';
import { Table } from '~/components/data/Table';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { DateRangeFilter, type DateRange } from '~/components/form/DateRangeFilter';
import { StatCard } from '~/components/ui/StatCard';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { todayVN } from '~/lib/time';
import { useShopReport } from '../hooks/useShop';

type TopProduct = ShopReport['topProducts'][number];
type LowStockRow = ShopReport['lowStock'][number];

const topColumns: TableColumnsType<TopProduct> = [
  {
    title: 'Sản phẩm',
    key: 'product',
    render: (_, row) => (
      <div className="flex flex-col">
        <b>{row.product.name}</b>
        <span className="font-mono text-[13.5px] text-sc-muted">{row.product.sku}</span>
      </div>
    ),
  },
  { title: 'Đã bán', dataIndex: 'units', align: 'right', className: 'tabular-nums' },
  {
    title: 'Doanh thu',
    dataIndex: 'revenue',
    align: 'right',
    render: (value: number) => <span className="whitespace-nowrap tabular-nums">{formatVND(value)}</span>,
  },
];

const lowColumns: TableColumnsType<LowStockRow> = [
  {
    title: 'Sản phẩm',
    key: 'product',
    render: (_, row) => (
      <div className="flex flex-col">
        <b>{row.name}</b>
        <span className="font-mono text-[13.5px] text-sc-muted">{row.sku}</span>
      </div>
    ),
  },
  {
    title: 'Còn',
    key: 'stock',
    align: 'right',
    render: (_, row) =>
      row.stock === 0 ? (
        <Tag color="error" className="!m-0">
          Hết hàng
        </Tag>
      ) : (
        <span className="font-semibold text-sc-warning tabular-nums">
          {row.stock} / {row.lowStockThreshold}
        </span>
      ),
  },
];

/** Manager tab: shop revenue for a date range, best sellers and what needs restocking. */
export function ShopReportPanel() {
  const today = todayVN();
  const [range, setRange] = useState<DateRange>({ from: `${today.slice(0, 8)}01`, to: today });
  const from = range.from ?? range.to ?? today;
  const to = range.to ?? today;
  const report = useShopReport(from, to < from ? from : to);
  const data = report.data;
  const maxCategory = Math.max(1, ...(data?.byCategory.map(({ revenue }) => revenue) ?? [0]));

  if (report.error && !data) {
    return <ErrorState message={toApiError(report.error).message} onRetry={() => void report.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <DateRangeFilter value={range} onChange={setRange} className="w-full sm:!w-72" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Doanh thu shop" icon={Coins} value={formatVND(data?.revenue ?? 0)} loading={!data} />
        <StatCard label="Sản phẩm đã bán" icon={Package} value={data?.units ?? 0} loading={!data} />
        <StatCard label="Đơn có sản phẩm" icon={Receipt} value={data?.orders ?? 0} loading={!data} />
        <StatCard
          label="Đang chờ nhận"
          icon={Clock}
          value={data?.pendingPickups ?? 0}
          tone={data?.pendingPickups ? 'warning' : 'default'}
          hint="Đơn online chưa lấy hàng"
          loading={!data}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Card title="Bán chạy" size="small">
          <Table<TopProduct>
            rowKey={(row) => row.product.id}
            size="small"
            columns={topColumns}
            dataSource={data?.topProducts}
            loading={report.isFetching}
            pagination={false}
            locale={{ emptyText: <EmptyState title="Chưa bán được sản phẩm nào trong khoảng này" /> }}
          />
        </Card>
        <div className="flex flex-col gap-4">
          <Card title="Theo danh mục" size="small">
            {data?.byCategory.length ? (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {data.byCategory.map((row) => (
                  <li key={row.category.id} className="flex flex-col gap-1">
                    <div className="flex justify-between gap-2 text-[14.5px]">
                      <span className="font-semibold">{row.category.name}</span>
                      <span className="tabular-nums">
                        {formatVND(row.revenue)} <span className="text-sc-muted">· {row.units} sp</span>
                      </span>
                    </div>
                    <Progress
                      percent={Math.round((row.revenue / maxCategory) * 100)}
                      showInfo={false}
                      size="small"
                      className="!m-0"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Chưa có dữ liệu" />
            )}
          </Card>
          <Card title="Cần nhập thêm" size="small">
            <Table<LowStockRow>
              rowKey="id"
              size="small"
              columns={lowColumns}
              dataSource={data?.lowStock}
              pagination={false}
              locale={{ emptyText: <EmptyState title="Không có sản phẩm sắp hết" /> }}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
