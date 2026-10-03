import { useNavigate } from '@tanstack/react-router';
import { App } from 'antd';
import type { CartStore } from '../store/cartStore';
import type { CheckoutItemInput } from '../types';
import { useMemberCart } from './useCart';

/**
 * Adds a selection to a cart store and tells the person what happened (added / already there).
 * antd renders toasts outside the router, so the "view cart" shortcut uses `navigate` instead of a `<Link>`.
 */
export function useAddToCart(store: CartStore, options: { cartPath?: '/cart'; cartLabel?: string } = {}) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  return (selection: CheckoutItemInput): boolean => {
    if (store.add(selection)) {
      const cartPath = options.cartPath;
      message.success({
        content: cartPath ? (
          <span>
            Đã thêm vào đơn.{' '}
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-sc-primary underline underline-offset-2"
              onClick={() => {
                message.destroy();
                void navigate({ to: cartPath });
              }}
            >
              {options.cartLabel ?? 'Xem giỏ hàng'}
            </button>
          </span>
        ) : (
          'Đã thêm vào đơn.'
        ),
      });
      return true;
    }
    message.info('Dịch vụ này đã có trong đơn.');
    return false;
  };
}

/** `add` for the signed-in member's own cart. */
export function useAddToMemberCart() {
  const { store } = useMemberCart();
  return useAddToCart(store, { cartPath: '/cart' });
}
