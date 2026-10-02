import { Button, Tooltip, type ButtonProps } from 'antd';
import { ShoppingCart } from 'lucide-react';
import { useAddToMemberCart } from '../hooks/useAddToCart';
import type { CheckoutItemInput } from '../types';

interface AddToCartButtonProps extends Pick<ButtonProps, 'type' | 'size' | 'block' | 'className'> {
  selection: CheckoutItemInput | null;
  /** Why the button is disabled; shown as a tooltip. */
  disabledReason?: string;
  label?: string;
  onAdded?: () => void;
}

/** "Thêm vào đơn": puts a service in the member's cart (browser storage, nothing is reserved yet). */
export function AddToCartButton({
  selection,
  disabledReason,
  label = 'Thêm vào đơn',
  onAdded,
  type = 'primary',
  ...rest
}: AddToCartButtonProps) {
  const add = useAddToMemberCart();
  const disabled = !selection || Boolean(disabledReason);

  return (
    <Tooltip title={disabledReason}>
      <span className={rest.block ? 'block' : 'inline-block'}>
        <Button
          {...rest}
          type={type}
          icon={<ShoppingCart size={16} />}
          disabled={disabled}
          onClick={() => {
            if (selection && add(selection)) onAdded?.();
          }}
        >
          {label}
        </Button>
      </span>
    </Tooltip>
  );
}
