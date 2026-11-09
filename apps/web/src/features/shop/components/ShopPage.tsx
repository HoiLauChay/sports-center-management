import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Alert, Button, Card, Pagination, Segmented, Select, Skeleton } from 'antd';
import { ShoppingCart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { SearchInput } from '~/components/form/SearchInput';
import { PageHeader } from '~/components/ui/PageHeader';
import { sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useAddToMemberCart } from '~/features/checkout/hooks/useAddToCart';
import { useMemberCart } from '~/features/checkout/hooks/useCart';
import { toApiError } from '~/lib/http-errors';
import { useProductCategories, useProducts } from '../hooks/useShop';
import { ProductCard } from './ProductCard';

const PAGE_SIZE = 12;

/** Member: browse the shop, put products in the cart and collect them at the counter after paying. */
export function ShopPage() {
  const categories = useProductCategories();
  const sports = useQuery(sportsQueryOptions);
  const { store, cart, count } = useMemberCart();
  const add = useAddToMemberCart();

  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('ALL');
  const [sportId, setSportId] = useState<string>();
  const [page, setPage] = useState(1);
  const products = useProducts({
    q: q || undefined,
    categoryId: categoryId === 'ALL' ? undefined : categoryId,
    sportId,
    page,
    limit: PAGE_SIZE,
  });

  const inCart = useMemo(
    () =>
      new Map(
        cart.lines.flatMap(({ selection }) =>
          selection.type === 'PRODUCT_SALE' ? [[selection.productId, selection.quantity] as const] : [],
        ),
      ),
    [cart.lines],
  );
  const items = products.data?.items ?? [];
  const filtered = Boolean(q || sportId || categoryId !== 'ALL');

  return (
    <>
      <PageHeader
        title="Cửa hàng"
        description="Dụng cụ, đồ uống và phụ kiện của trung tâm."
        extra={
          <Link to="/cart">
            <Button icon={<ShoppingCart size={16} />}>Giỏ hàng{count ? ` (${count})` : ''}</Button>
          </Link>
        }
      />
      <Alert
        type="info"
        showIcon
        className="!mb-4"
        title="Thanh toán bằng ví, sau đó nhận hàng tại quầy lễ tân. Đơn chưa nhận có thể hủy để hoàn tiền về ví; quá hạn nhận đơn sẽ tự hủy và hoàn tiền."
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchInput
            placeholder="Tìm sản phẩm..."
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            className="w-full sm:!w-64"
          />
          <Select
            allowClear
            placeholder="Mọi bộ môn"
            value={sportId}
            onChange={(value: string | undefined) => {
              setSportId(value);
              setPage(1);
            }}
            options={(sports.data ?? [])
              .filter((sport) => sport.isActive)
              .map((sport) => ({ value: sport.id, label: sport.name }))}
            className="w-full sm:!w-48"
          />
          <div className="max-w-full overflow-x-auto">
            <Segmented
              value={categoryId}
              onChange={(value) => {
                setCategoryId(value as string);
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả' },
                ...(categories.data ?? []).map((category) => ({ value: category.id, label: category.name })),
              ]}
            />
          </div>
        </div>

        {products.error && !products.data ? (
          <ErrorState message={toApiError(products.error).message} onRetry={() => void products.refetch()} />
        ) : products.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="rounded-xl border border-sc-border-soft p-3">
                <Skeleton.Image active className="!h-40 !w-full" />
                <Skeleton active paragraph={{ rows: 2 }} className="!mt-3" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title={filtered ? 'Không tìm thấy sản phẩm phù hợp' : 'Cửa hàng chưa có sản phẩm'}
            description={filtered ? 'Thử đổi bộ lọc hoặc từ khóa' : undefined}
          />
        ) : (
          <>
            <div
              className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 ${products.isFetching ? 'opacity-70' : ''}`}
            >
              {items.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={inCart.get(product.id) ?? 0}
                  onAdd={() => add({ type: 'PRODUCT_SALE', productId: product.id, quantity: 1 })}
                  onQuantity={(quantity) => store.setProductQuantity(product.id, quantity)}
                />
              ))}
            </div>
            {(products.data?.total ?? 0) > PAGE_SIZE && (
              <div className="mt-4 flex justify-end">
                <Pagination
                  current={page}
                  pageSize={PAGE_SIZE}
                  total={products.data?.total}
                  onChange={setPage}
                  showSizeChanger={false}
                />
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
