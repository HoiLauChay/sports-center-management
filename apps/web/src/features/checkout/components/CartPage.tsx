import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Alert, App, Button, Card, Popconfirm } from 'antd';
import { Plus, ShoppingCart } from 'lucide-react';
import { EmptyState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { WalletCard } from '~/components/ui/WalletCard';
import { useCurrentUser } from '~/features/auth';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { quoteQueryKey, useMemberCart, useQuote } from '../hooks/useCart';
import { useCheckout } from '../hooks/useCheckout';
import { checkoutService } from '../services/checkout.service';
import type { Quote } from '../types';
import { blockedReason } from '../utils';
import { CouponInput } from './CouponInput';
import { PriceChangeModal } from './PriceChangeModal';
import { QuoteLines } from './QuoteLines';
import { QuoteTotals } from './QuoteTotals';

export function CartPage() {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { store, cart } = useMemberCart();
  const items = cart.lines.map((line) => line.selection);
  const quoteQuery = useQuote({ user, items, couponCodes: cart.couponCodes });
  const quote = cart.lines.length ? quoteQuery.data : undefined;

  const checkout = useCheckout({
    onPaid: (order) => {
      store.reset();
      message.success(`Đã thanh toán ${formatVND(order.totalAmount)}, mã đơn ${order.orderNumber}`);
      void navigate({ to: '/orders/$orderId', params: { orderId: order.id } });
    },
    onQuote: (fresh) => queryClient.setQueryData(quoteQueryKey(user.id, undefined, items, cart.couponCodes), fresh),
  });

  const insufficient = quote?.walletBalance !== null && quote !== undefined && (quote.walletBalance ?? 0) < quote.total;
  const shortBy = quote ? quote.total - (quote.walletBalance ?? 0) : 0;
  const pay = (expectedTotal: number) =>
    checkout.pay({ user, items, couponCodes: cart.couponCodes, paymentMethod: 'WALLET', expectedTotal });

  return (
    <>
      <PageHeader
        title="Giỏ hàng"
        extra={
          cart.lines.length > 0 && (
            <Popconfirm
              title="Xóa toàn bộ giỏ hàng?"
              okText="Xóa hết"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={store.clear}
            >
              <Button danger>Xóa hết</Button>
            </Popconfirm>
          )
        }
      />
      {cart.lines.length === 0 ? (
        <Card>
          <EmptyState
            title="Giỏ hàng đang trống"
            description="Chọn dịch vụ rồi bấm “Thêm vào giỏ” để bắt đầu."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/bookings">
                  <Button type="primary" icon={<Plus size={16} />}>
                    Đặt sân
                  </Button>
                </Link>
                <Link to="/classes">
                  <Button>Đăng ký lớp</Button>
                </Link>
                <Link to="/memberships">
                  <Button>Gói thành viên</Button>
                </Link>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Card>
              <SectionTitle>Dịch vụ trong giỏ ({cart.lines.length})</SectionTitle>
              {quoteQuery.isError && (
                <Alert
                  type="error"
                  showIcon
                  className="!mb-3"
                  title={toApiError(quoteQuery.error).message}
                  action={
                    <Button size="small" onClick={() => void quoteQuery.refetch()}>
                      Thử lại
                    </Button>
                  }
                />
              )}
              <QuoteLines
                lines={cart.lines}
                quote={quote}
                pricing={quoteQuery.isFetching && !quote}
                onRemove={store.remove}
                disabled={checkout.isPaying}
              />
            </Card>
            <Card>
              <CouponInput
                codes={cart.couponCodes}
                quote={quote}
                check={(couponCodes) => checkoutService.quote({ items, couponCodes })}
                onAdd={store.addCoupon}
                onRemove={store.removeCoupon}
                disabled={checkout.isPaying}
              />
            </Card>
          </div>
          <div className="flex flex-col gap-4 xl:sticky xl:top-4">
            <WalletCard
              balance={quote?.walletBalance ?? 0}
              description={
                <Link to="/wallet/top-up" className="!text-sc-lime underline underline-offset-2">
                  Nạp thêm tiền vào ví
                </Link>
              }
            />
            <Card>
              <SectionTitle>Thanh toán</SectionTitle>
              {quote ? (
                <>
                  <QuoteTotals quote={quote} />
                  {insufficient && (
                    <Alert
                      type="warning"
                      showIcon
                      className="!mt-3"
                      title={`Ví còn thiếu ${formatVND(shortBy)}`}
                      action={
                        <Link to="/wallet/top-up">
                          <Button size="small">Nạp ví</Button>
                        </Link>
                      }
                    />
                  )}
                  <Button
                    type="primary"
                    size="large"
                    block
                    className="!mt-4"
                    icon={<ShoppingCart size={17} />}
                    disabled={!quote.canCheckout || insufficient || quoteQuery.isFetching}
                    loading={checkout.isPaying}
                    onClick={() => pay(quote.total)}
                  >
                    Thanh toán bằng ví · {formatVND(quote.total)}
                  </Button>
                  {!quote.canCheckout && (
                    <p className="mt-2 mb-0 text-[14.5px] text-sc-error">{blockedReason(quote)} để thanh toán.</p>
                  )}
                </>
              ) : (
                <p className="m-0 text-sc-muted">Đang tính giá…</p>
              )}
            </Card>
          </div>
        </div>
      )}
      {cart.lines.length > 0 && quote && (
        <>
          <div className="h-16 md:hidden" />
          <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 border-t border-t-sc-border-soft bg-white px-4 py-3 shadow-[0_-6px_20px_rgba(20,19,15,0.08)] md:hidden">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[14.5px] text-sc-muted">Phải trả</span>
              <span className="font-semibold tabular-nums">{formatVND(quote.total)}</span>
            </div>
            {insufficient ? (
              <Link to="/wallet/top-up">
                <Button type="primary">Nạp ví</Button>
              </Link>
            ) : (
              <Button
                type="primary"
                disabled={!quote.canCheckout || quoteQuery.isFetching}
                loading={checkout.isPaying}
                onClick={() => pay(quote.total)}
              >
                Thanh toán bằng ví
              </Button>
            )}
          </div>
        </>
      )}
      <PriceChangeModal
        change={checkout.priceChange}
        confirming={checkout.isPaying}
        onConfirm={(fresh: Quote) => pay(fresh.total)}
        onCancel={checkout.dismissPriceChange}
      />
    </>
  );
}
