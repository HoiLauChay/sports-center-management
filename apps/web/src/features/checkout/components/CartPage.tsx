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
import type { Quote } from '../types';
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
  const quoteQuery = useQuote({ user, items, couponCode: cart.couponCode });
  const quote = cart.lines.length ? quoteQuery.data : undefined;

  const checkout = useCheckout({
    onPaid: (order) => {
      store.reset();
      message.success(`Đã thanh toán ${formatVND(order.totalAmount)}, mã đơn ${order.orderNumber}`);
      void navigate({ to: '/orders/$orderId', params: { orderId: order.id } });
    },
    onQuote: (fresh) => queryClient.setQueryData(quoteQueryKey(user.id, undefined, items, cart.couponCode), fresh),
  });

  const insufficient = quote?.walletBalance !== null && quote !== undefined && (quote.walletBalance ?? 0) < quote.total;
  const shortBy = quote ? quote.total - (quote.walletBalance ?? 0) : 0;
  const pay = (expectedTotal: number) =>
    checkout.pay({ user, items, couponCode: cart.couponCode, paymentMethod: 'WALLET', expectedTotal });

  return (
    <>
      <PageHeader
        title="Giỏ hàng"
        description="Thêm đặt sân, lớp học, gói thành viên vào cùng một đơn rồi thanh toán bằng ví. Giỏ chưa giữ chỗ, hệ thống kiểm tra lại khi thanh toán."
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
            description="Chọn dịch vụ rồi bấm “Thêm vào đơn” để bắt đầu."
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
              <SectionTitle>Dịch vụ trong đơn ({cart.lines.length})</SectionTitle>
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
                key={cart.couponCode}
                code={cart.couponCode}
                quote={quote}
                onApply={store.setCoupon}
                disabled={checkout.isPaying}
              />
            </Card>
          </div>
          <div className="flex flex-col gap-4 xl:sticky xl:top-20">
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
                    <p className="mt-2 mb-0 text-xs text-sc-error">
                      Còn dịch vụ không hợp lệ: xóa hoặc sửa dòng báo lỗi để thanh toán.
                    </p>
                  )}
                  <p className="mt-3 mb-0 text-xs text-sc-muted-2">
                    Hệ thống kiểm tra lại chỗ trống, mã giảm giá và số dư khi thanh toán. Một dòng lỗi thì cả đơn không
                    được thanh toán.
                  </p>
                </>
              ) : (
                <p className="m-0 text-sc-muted">Đang tính giá…</p>
              )}
            </Card>
          </div>
        </div>
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
