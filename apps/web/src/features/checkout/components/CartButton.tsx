import { useNavigate } from '@tanstack/react-router';
import { Badge } from 'antd';
import { ShoppingCart } from 'lucide-react';
import { IconButton } from '~/components/ui/IconButton';
import { useMemberCart } from '../hooks/useCart';

/** Header shortcut to the cart with the number of lines in it. */
export function CartButton() {
  const navigate = useNavigate();
  const { count } = useMemberCart();
  return (
    <Badge count={count} size="small" offset={[-4, 4]}>
      <IconButton
        aria-label={count ? `Giỏ hàng, ${count} dịch vụ` : 'Giỏ hàng'}
        onClick={() => void navigate({ to: '/cart' })}
      >
        <ShoppingCart size={17} />
      </IconButton>
    </Badge>
  );
}
