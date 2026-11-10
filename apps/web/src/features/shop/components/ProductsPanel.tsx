import type { Product } from '@sports-center/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { App, Button, Checkbox, Select, Switch, Tag, Tooltip, type TableColumnsType } from 'antd';
import { Plus, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { RowActions } from '~/components/data/RowActions';
import { Table } from '~/components/data/Table';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { SearchInput } from '~/components/form/SearchInput';
import { sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useConfirm } from '~/hooks/useConfirm';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useProductCategories, useProducts, useRefreshShop } from '../hooks/useShop';
import { shopService } from '../services/shop.service';
import { lastPageOf } from '../utils';
import { ProductFormModal } from './ProductFormModal';
import { ProductThumb } from './ProductThumb';
import { MovementsDrawer, StockModal } from './StockDialogs';

/** Manager tab: every product with its price, stock and on-sale switch. */
export function ProductsPanel() {
  const { message } = App.useApp();
  const confirm = useConfirm();
  const refresh = useRefreshShop();
  const categories = useProductCategories(true);
  const sports = useQuery(sportsQueryOptions);

  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState<string>();
  const [sportId, setSportId] = useState<string>();
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const products = useProducts({
    q: q || undefined,
    categoryId,
    sportId,
    lowStock: lowStock ? 'true' : undefined,
    includeInactive: 'true',
    page,
    limit,
  });

  const lastPage = lastPageOf(products.data, page, limit);
  if (lastPage !== null) setPage(lastPage);

  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [stockOf, setStockOf] = useState<Product | null>(null);
  const [ledgerOf, setLedgerOf] = useState<Product | null>(null);

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => shopService.updateProduct(id, { isActive }),
    onSuccess: (product) => {
      void refresh();
      message.success(product.isActive ? `Đã mở bán ${product.name}` : `Đã ngừng bán ${product.name}`);
    },
    onError: (error) => message.error(toApiError(error).message),
  });
  const remove = useMutation({
    mutationFn: (product: Product) => shopService.removeProduct(product.id),
    onSuccess: (_, product) => {
      void refresh();
      message.success(`Đã xóa ${product.name}`);
    },
    onError: (error) => message.error(toApiError(error).message),
  });

  const openForm = (product: Product | null) => {
    setEditing(product);
    setFormOpen(true);
  };
  const resetPage =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  const columns: TableColumnsType<Product> = [
    {
      title: 'Sản phẩm',
      key: 'product',
      render: (_, product) => (
        <div className="flex min-w-56 items-center gap-3">
          <ProductThumb imageUrl={product.imageUrl} name={product.name} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <b className="leading-snug [overflow-wrap:anywhere]">{product.name}</b>
            <span className="font-mono text-[13.5px] text-sc-muted">{product.sku}</span>
            <div className="flex flex-wrap gap-1">
              <Tag className="!m-0">{product.category.name}</Tag>
              {product.sport && <Tag className="!m-0">{product.sport.name}</Tag>}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Giá',
      dataIndex: 'price',
      align: 'right',
      render: (price: number) => <span className="whitespace-nowrap tabular-nums">{formatVND(price)}</span>,
    },
    {
      title: 'Tồn kho',
      key: 'stock',
      align: 'right',
      render: (_, product) => (
        <div className="flex flex-col items-end gap-0.5">
          <span
            className={`inline-flex items-center gap-1 font-semibold tabular-nums ${
              product.lowStock ? 'text-sc-warning' : 'text-sc-ink'
            }`}
          >
            {product.lowStock && (
              <Tooltip title={`Còn ≤ ${product.lowStockThreshold} sản phẩm`}>
                <TriangleAlert size={14} aria-label="Sắp hết hàng" />
              </Tooltip>
            )}
            {product.stock}
          </span>
          {product.reserved > 0 && (
            <Tooltip title="Đã bán online, đang chờ thành viên đến lấy: vẫn nằm trên kệ nhưng không bán tiếp">
              <span className="text-[13.5px] whitespace-nowrap text-sc-muted">+{product.reserved} chờ nhận</span>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, product) => (
        <div className="flex items-center justify-end gap-3">
          <Switch
            checked={product.isActive}
            aria-label={`Đang bán ${product.name}`}
            loading={toggle.isPending && toggle.variables.id === product.id}
            onChange={(isActive) => toggle.mutate({ id: product.id, isActive })}
          />
          <RowActions
            label={`Thao tác với ${product.name}`}
            inlineLimit={2}
            actions={[
              { key: 'stock', label: 'Kho', primary: true, onClick: () => setStockOf(product) },
              { key: 'edit', label: 'Sửa', onClick: () => openForm(product) },
              { key: 'ledger', label: 'Lịch sử kho', onClick: () => setLedgerOf(product) },
              {
                key: 'delete',
                label: 'Xóa',
                danger: true,
                onClick: () =>
                  confirm({
                    title: `Xóa ${product.name}?`,
                    content: 'Sản phẩm biến khỏi cửa hàng; các đơn đã bán vẫn giữ nguyên thông tin.',
                    okText: 'Xóa',
                    onOk: () => remove.mutateAsync(product).catch(() => undefined),
                  }),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  const filtered = Boolean(q || categoryId || sportId || lowStock);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder="Tìm theo tên, SKU..."
          value={q}
          onChange={resetPage(setQ)}
          className="w-full sm:!w-64"
        />
        <Select
          allowClear
          placeholder="Danh mục"
          value={categoryId}
          onChange={resetPage(setCategoryId)}
          options={(categories.data ?? []).map((category) => ({ value: category.id, label: category.name }))}
          className="w-full sm:!w-44"
        />
        <Select
          allowClear
          placeholder="Bộ môn"
          value={sportId}
          onChange={resetPage(setSportId)}
          options={(sports.data ?? []).map((sport) => ({ value: sport.id, label: sport.name }))}
          className="w-full sm:!w-44"
        />
        <Checkbox checked={lowStock} onChange={(event) => resetPage(setLowStock)(event.target.checked)}>
          Sắp hết hàng
        </Checkbox>
        <Button type="primary" icon={<Plus size={16} />} className="sm:!ml-auto" onClick={() => openForm(null)}>
          Thêm sản phẩm
        </Button>
      </div>

      {products.error && !products.data ? (
        <ErrorState message={toApiError(products.error).message} onRetry={() => void products.refetch()} />
      ) : (
        <Table<Product>
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={products.data?.items}
          loading={products.isFetching}
          rowClassName={(product) => (product.isActive ? '' : 'opacity-60')}
          pagination={{
            current: page,
            pageSize: limit,
            total: products.data?.total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total) => `${total} sản phẩm`,
            onChange: (next, size) => {
              setPage(next);
              setLimit(size);
            },
          }}
          locale={{
            emptyText: products.isPending ? (
              ' '
            ) : (
              <EmptyState
                title={filtered ? 'Không tìm thấy sản phẩm phù hợp' : 'Chưa có sản phẩm'}
                description={
                  filtered
                    ? 'Thử đổi bộ lọc'
                    : categories.data?.length
                      ? undefined
                      : 'Tạo danh mục ở tab Danh mục trước khi thêm sản phẩm'
                }
              />
            ),
          }}
        />
      )}

      <ProductFormModal open={formOpen} product={editing} onClose={() => setFormOpen(false)} />
      <StockModal product={stockOf} onClose={() => setStockOf(null)} />
      <MovementsDrawer product={ledgerOf} onClose={() => setLedgerOf(null)} />
    </>
  );
}
