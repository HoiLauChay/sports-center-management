import { MAX_PRODUCT_QUANTITY, type Product } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Button } from 'antd';
import { Plus, ShoppingBag } from 'lucide-react';
import { useMemo } from 'react';
import { useAddToMemberCart } from '~/features/checkout/hooks/useAddToCart';
import { useMemberCart } from '~/features/checkout/hooks/useCart';
import { formatVND } from '~/lib/format';
import { useProducts } from '../hooks/useShop';
import { CartStepper } from './ProductCard';
import { ProductThumb } from './ProductThumb';

interface ProductSuggestionsProps {
  /** Sports of what is being booked: products of these sports come first, then ones for every sport. */
  sportIds: string[];
  title: string;
  description?: string;
  limit?: number;
  /** Leave out products already in the cart (the cart page lists them itself). */
  hideInCart?: boolean;
  /**
   * `card`: a section of its own, items in a two-column grid.
   * `inline`: a plain list meant to sit inside another panel (e.g. the selected-slot summary).
   */
  variant?: 'card' | 'inline';
  className?: string;
}

/** Rank: same sport first, then products for every sport; only what is in stock; cheaper add-ons before pricier gear. */
function pick(products: Product[], sportIds: string[], skip: Set<string>, limit: number) {
  const fits = (product: Product) => !product.sport || sportIds.includes(product.sport.id);
  return products
    .filter((product) => product.stock > 0 && fits(product) && !skip.has(product.id))
    .sort((a, b) => Number(!a.sport) - Number(!b.sport) || a.price - b.price)
    .slice(0, limit);
}

/** "Mua kèm" for members: a few products matching the sport of a booking, added to the cart in one tap. */
export function ProductSuggestions({
  sportIds,
  title,
  description,
  limit = 4,
  hideInCart = false,
  variant = 'card',
  className = '',
}: ProductSuggestionsProps) {
  const products = useProducts({ page: 1, limit: 100 });
  const { store, cart } = useMemberCart();
  const add = useAddToMemberCart();
  const inline = variant === 'inline';

  const inCart = useMemo(
    () =>
      new Map(
        cart.lines.flatMap(({ selection }) =>
          selection.type === 'PRODUCT_SALE' ? [[selection.productId, selection.quantity] as const] : [],
        ),
      ),
    [cart.lines],
  );
  const items = useMemo(
    () => pick(products.data?.items ?? [], sportIds, hideInCart ? new Set(inCart.keys()) : new Set(), limit),
    [products.data, sportIds, hideInCart, inCart, limit],
  );

  if (!items.length) return null;

  const rows = items.map((product) => {
    const quantity = inCart.get(product.id) ?? 0;
    return (
      <li
        key={product.id}
        className={
          inline
            ? 'flex items-center gap-2.5 py-2'
            : `flex items-center gap-3 rounded-lg border p-2 transition-colors ${
                quantity ? 'border-sc-primary-border bg-sc-primary-soft/40' : 'border-sc-border-soft'
              }`
        }
      >
        <ProductThumb imageUrl={product.imageUrl} name={product.name} size={inline ? 36 : 44} />
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span
            className={`${inline ? 'truncate text-[14px]' : 'line-clamp-2 text-[14.5px]'} font-semibold text-sc-ink`}
            title={product.name}
          >
            {product.name}
          </span>
          <span className="text-[13.5px] text-sc-muted tabular-nums">{formatVND(product.price)}</span>
        </div>
        {quantity ? (
          <CartStepper
            size="small"
            quantity={quantity}
            max={Math.min(product.stock, MAX_PRODUCT_QUANTITY)}
            onQuantity={(next) => store.setProductQuantity(product.id, next)}
          />
        ) : (
          <Button
            size="small"
            shape="circle"
            aria-label={`Thêm ${product.name} vào giỏ`}
            icon={<Plus size={14} />}
            onClick={() => add({ type: 'PRODUCT_SALE', productId: product.id, quantity: 1 })}
            className="shrink-0"
          />
        )}
      </li>
    );
  });

  if (inline) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-[13.5px] font-bold tracking-[0.12em] text-sc-muted uppercase">
            {title}
          </span>
          <Link to="/shop" className="text-[13.5px] font-semibold">
            Xem thêm
          </Link>
        </div>
        {description && <p className="mt-0.5 mb-0 text-[13.5px] text-sc-muted">{description}</p>}
        <ul className="m-0 list-none divide-y divide-sc-border-soft p-0">{rows}</ul>
      </div>
    );
  }

  return (
    <section className={`rounded-xl border border-sc-border-soft bg-white p-4 ${className}`}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col">
          <h3 className="m-0 flex items-center gap-2 font-display text-[17px] font-bold tracking-wide uppercase">
            <ShoppingBag size={17} className="text-sc-primary" />
            {title}
          </h3>
          {description && <span className="text-[14px] text-sc-muted">{description}</span>}
        </div>
        <Link to="/shop" className="text-[14.5px] font-semibold">
          Xem cửa hàng →
        </Link>
      </div>
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">{rows}</ul>
    </section>
  );
}
