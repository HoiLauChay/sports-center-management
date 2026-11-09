import type { Product } from '@sports-center/shared';
import { MAX_PRODUCT_QUANTITY } from '@sports-center/shared';
import { Button } from 'antd';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatVND } from '~/lib/format';
import { stockText } from '../utils';
import { ProductThumb } from './ProductThumb';

interface ProductCardProps {
  product: Product;
  /** Units of this product already in the cart / counter draft; 0 when it is not there. */
  quantity: number;
  onAdd: () => void;
  /** Sets the quantity already in the cart; 0 takes the product out. */
  onQuantity: (quantity: number) => void;
  /** Counter layout: picture beside the text, denser grid. */
  compact?: boolean;
}

function stockTone(product: Product) {
  if (!product.stock) return 'font-semibold text-sc-error';
  return product.lowStock ? 'text-sc-warning' : 'text-sc-muted';
}

/** − n + bound to the cart line; the minus turns into a bin at 1. */
export function CartStepper({
  quantity,
  max,
  onQuantity,
  size = 'middle',
}: {
  quantity: number;
  max: number;
  onQuantity: (q: number) => void;
  size?: 'middle' | 'small';
}) {
  const small = size === 'small';
  const button = `flex h-full ${small ? 'w-7' : 'w-9'} cursor-pointer items-center justify-center border-0 bg-transparent text-sc-primary hover:bg-sc-primary-soft`;
  return (
    <div
      className={`flex ${small ? 'h-7 rounded-md' : 'h-9 rounded-lg'} shrink-0 items-center overflow-hidden border border-sc-primary bg-white`}
    >
      <button
        type="button"
        aria-label={quantity === 1 ? 'Bỏ khỏi đơn' : 'Giảm 1'}
        onClick={() => onQuantity(quantity - 1)}
        className={button}
      >
        {quantity === 1 ? <Trash2 size={small ? 13 : 15} /> : <Minus size={small ? 14 : 16} />}
      </button>
      <span
        className={`${small ? 'min-w-6 text-[14.5px]' : 'min-w-8 text-[17px]'} text-center font-display font-bold text-sc-ink tabular-nums`}
        aria-live="polite"
      >
        {quantity}
      </span>
      <button
        type="button"
        aria-label="Thêm 1"
        disabled={quantity >= max}
        onClick={() => onQuantity(quantity + 1)}
        className={`${button} disabled:cursor-not-allowed disabled:text-sc-muted-2 disabled:hover:bg-transparent`}
      >
        <Plus size={small ? 14 : 16} />
      </button>
    </div>
  );
}

/** One product of the catalog: "Thêm" puts one in, then the stepper edits the cart line directly. */
export function ProductCard({ product, quantity, onAdd, onQuantity, compact }: ProductCardProps) {
  const max = Math.min(product.stock, MAX_PRODUCT_QUANTITY);
  const inCart = quantity > 0;
  const soldOut = max <= 0;

  const action = inCart ? (
    <CartStepper quantity={quantity} max={max} onQuantity={onQuantity} />
  ) : (
    <Button
      type={compact ? 'default' : 'primary'}
      icon={<Plus size={15} />}
      disabled={soldOut}
      onClick={onAdd}
      className={compact ? '!h-9 !font-semibold' : '!h-9 w-full !font-semibold'}
    >
      {soldOut ? 'Hết hàng' : compact ? 'Thêm' : 'Thêm vào giỏ'}
    </Button>
  );

  const thumb = (
    <span className="relative shrink-0">
      <ProductThumb
        imageUrl={product.imageUrl}
        name={product.name}
        size={compact ? 64 : 160}
        className={compact ? '' : '!h-44 !w-full'}
      />
      {inCart && (
        <span className="absolute -top-1.5 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-sc-primary px-1.5 text-[12.5px] font-bold text-white shadow-sm tabular-nums">
          {quantity}
        </span>
      )}
    </span>
  );

  const meta = (
    <span className="flex flex-wrap items-center gap-x-1.5 text-[13.5px]">
      {product.sport && <span className="text-sc-ink-2">{product.sport.name}</span>}
      {product.sport && <span className="text-sc-muted-2">·</span>}
      <span className={stockTone(product)}>{stockText(product)}</span>
    </span>
  );

  const cardTone = inCart
    ? 'border-sc-primary-border bg-sc-primary-soft/40 shadow-[inset_0_0_0_1px_var(--sc-primary-border)]'
    : 'border-sc-border-soft bg-white hover:border-sc-border hover:shadow-sm';

  if (compact) {
    return (
      <article
        className={`flex gap-3 rounded-xl border p-3 transition-all ${cardTone} ${soldOut && !inCart ? 'opacity-60' : ''}`}
      >
        {thumb}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <b className="line-clamp-2 text-[15px] leading-snug text-sc-ink" title={product.name}>
            {product.name}
          </b>
          {meta}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
            <b className="font-display text-[18px] text-sc-ink tabular-nums">{formatVND(product.price)}</b>
            {action}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`flex flex-col gap-3 rounded-xl border p-3 transition-all ${cardTone} ${soldOut && !inCart ? 'opacity-60' : ''}`}
    >
      {thumb}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <b className="line-clamp-2 text-[15px] leading-snug text-sc-ink" title={product.name}>
          {product.name}
        </b>
        {meta}
        {product.description && <p className="m-0 line-clamp-2 text-[14px] text-sc-muted">{product.description}</p>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <b className="font-display text-[20px] text-sc-ink tabular-nums">{formatVND(product.price)}</b>
        {inCart && action}
      </div>
      {!inCart && action}
    </article>
  );
}
