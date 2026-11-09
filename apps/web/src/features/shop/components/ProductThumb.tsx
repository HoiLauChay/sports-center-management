import { Package } from 'lucide-react';

interface ProductThumbProps {
  imageUrl: string | null;
  name: string;
  size?: number;
  className?: string;
}

/** Square product picture, or a package glyph when the product has none. */
export function ProductThumb({ imageUrl, name, size = 48, className = '' }: ProductThumbProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-sc-border-soft bg-sc-paper text-sc-muted ${className}`}
      style={{ width: size, height: size }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="size-full object-cover" loading="lazy" />
      ) : (
        <Package size={Math.round(size * 0.45)} aria-hidden />
      )}
    </span>
  );
}
