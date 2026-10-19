import { useNavigate } from '@tanstack/react-router';
import { Button, Tooltip, type ButtonProps } from 'antd';
import { Check, ShoppingCart } from 'lucide-react';
import { useAddToMemberCart } from '../hooks/useAddToCart';
import { useMemberCart } from '../hooks/useCart';
import type { CheckoutItemInput } from '../types';
import { selectionKey } from '../utils';

interface AddToCartButtonProps extends Pick<ButtonProps, 'type' | 'size' | 'block' | 'className'> {
  selection: CheckoutItemInput | null;
  /** Why the button is disabled; shown as a tooltip. */
  disabledReason?: string;
  label?: string;
  onAdded?: () => void;
}

export function AddToCartButton({
  selection,
  disabledReason,
  label = 'Thêm vào giỏ',
  onAdded,
  type = 'primary',
  ...rest
}: AddToCartButtonProps) {
  const navigate = useNavigate();
  const add = useAddToMemberCart();
  const { cart } = useMemberCart();
  const inCart =
    selection !== null && cart.lines.some((line) => selectionKey(line.selection) === selectionKey(selection));
  const disabled = !selection || Boolean(disabledReason);

  if (inCart) {
    return (
      <span className={rest.block ? 'block' : 'inline-block'}>
        <Button {...rest} icon={<Check size={16} />} onClick={() => void navigate({ to: '/cart' })}>
          Đã có trong giỏ · Xem giỏ
        </Button>
      </span>
    );
  }

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
