import type { CheckoutItemInput } from '@sports-center/shared';
import { Segmented, Skeleton } from 'antd';
import { useState } from 'react';
import { EmptyState } from '~/components/feedback/States';
import { SearchInput } from '~/components/form/SearchInput';
import { useProductCategories, useProducts } from '../hooks/useShop';
import { ProductCard } from './ProductCard';

interface CounterProductPickerProps {
  onAdd: (selection: CheckoutItemInput) => void;
  /** Quantity of each product already in the counter draft, by product id. */
  inCart: Map<string, number>;
  /** Sets the quantity of a product already in the draft; 0 removes it. */
  onQuantity: (productId: string, quantity: number) => void;
}

/** Counter tab: sell shop products to members and walk-in guests. */
export function CounterProductPicker({ onAdd, inCart, onQuantity }: CounterProductPickerProps) {
  const categories = useProductCategories();
  const [categoryId, setCategoryId] = useState<string>('ALL');
  const [q, setQ] = useState('');
  const products = useProducts({
    q: q || undefined,
    categoryId: categoryId === 'ALL' ? undefined : categoryId,
    page: 1,
    limit: 60,
  });
  const items = products.data?.items ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Tìm tên, mã SKU..." value={q} onChange={setQ} className="w-full sm:!w-64" />
        <div className="max-w-full overflow-x-auto">
          <Segmented
            value={categoryId}
            onChange={(value) => setCategoryId(value as string)}
            options={[
              { value: 'ALL', label: 'Tất cả' },
              ...(categories.data ?? []).map((category) => ({ value: category.id, label: category.name })),
            ]}
          />
        </div>
      </div>
      {products.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="rounded-xl border border-sc-border-soft p-4">
              <Skeleton active avatar paragraph={{ rows: 2 }} />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={q || categoryId !== 'ALL' ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm đang bán'} />
      ) : (
        <div className={`grid gap-3 sm:grid-cols-2 2xl:grid-cols-3 ${products.isFetching ? 'opacity-70' : ''}`}>
          {items.map((product) => (
            <ProductCard
              key={product.id}
              compact
              product={product}
              quantity={inCart.get(product.id) ?? 0}
              onAdd={() => onAdd({ type: 'PRODUCT_SALE', productId: product.id, quantity: 1 })}
              onQuantity={(quantity) => onQuantity(product.id, quantity)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
