import type { PaymentMethod } from '@sports-center/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { Alert, Button, Card, Popconfirm, Radio, Result } from 'antd';
import { CreditCard, LayoutGrid, Printer, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageLoading } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { PAYMENT_METHOD_LABEL } from '~/constants/payment';
import { useCurrentUser } from '~/features/auth';
import { CouponInput } from '~/features/checkout/components/CouponInput';
import { PriceChangeModal } from '~/features/checkout/components/PriceChangeModal';
import { QuoteLines } from '~/features/checkout/components/QuoteLines';
import { QuoteTotals } from '~/features/checkout/components/QuoteTotals';
import { useAddToCart } from '~/features/checkout/hooks/useAddToCart';
import { quoteQueryKey, useCounterDraft, useQuote } from '~/features/checkout/hooks/useCart';
import { useCheckout } from '~/features/checkout/hooks/useCheckout';
import { checkoutService } from '~/features/checkout/services/checkout.service';
import type { Order } from '~/features/checkout/types';
import { blockedReason } from '~/features/checkout/utils';
import { InvoiceSheet } from '~/features/orders/components/InvoiceSheet';
import { useOrder } from '~/features/orders/hooks/useOrders';
import { usersService } from '~/features/users/services/users.service';
import { InvoicePayPanel } from '~/features/wallet';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { buyerToApi, useCancelCounterInvoice, useCounterInvoice, useStartCounterTransfer } from '../hooks/useCounter';
import { CounterBuyerCard } from './CounterBuyerCard';
import { CounterServicePicker } from './CounterServicePicker';

const routeApi = getRouteApi('/_authenticated/_receptionist/reception/order');

const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER'];

function Receipt({ order, onNew }: { order: Order; onNew: () => void }) {
  return (
    <>
      <Card className="no-print">
        <Result
          status="success"
          title="Đã thu tiền thành công"
          subTitle={`Hóa đơn ${order.orderNumber} · ${formatVND(order.totalAmount)} · ${PAYMENT_METHOD_LABEL[order.paymentMethod]}`}
          extra={[
            <Button key="print" type="primary" icon={<Printer size={16} />} onClick={() => window.print()}>
              In biên lai
            </Button>,
            <Link key="detail" to="/reception/orders/$orderId" params={{ orderId: order.id }}>
              <Button>Xem hóa đơn</Button>
            </Link>,
            <Button key="new" onClick={onNew}>
              Tạo đơn mới
            </Button>,
          ]}
        />
      </Card>
      <InvoiceSheet order={order} />
    </>
  );
}

/** Pay-by-transfer phase: QR of the invoice, live status, cancel, and the receipt once the money arrived. */
function TransferPhase({
  invoiceId,
  onFinished,
  onBack,
}: {
  invoiceId: string;
  onFinished: () => void;
  onBack: () => void;
}) {
  const invoice = useCounterInvoice(invoiceId);
  const cancel = useCancelCounterInvoice();
  const orderQuery = useOrder(invoice.data?.orderId ?? '');
  const queryClient = useQueryClient();
  const paid = invoice.data?.status === 'PAID';

  useEffect(() => {
    if (paid) {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['facility-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    }
  }, [paid, queryClient]);

  if (invoice.isPending) return <PageLoading />;
  if (invoice.isError) return <Alert type="error" showIcon title={toApiError(invoice.error).message} />;
  const data = invoice.data;

  if (paid && orderQuery.data) return <Receipt order={orderQuery.data} onNew={onFinished} />;

  return (
    <Card>
      <SectionTitle>Chuyển khoản · hóa đơn {data.paymentCode}</SectionTitle>
      <InvoicePayPanel
        invoice={data}
        paidMessage={<>Đã nhận {formatVND(data.amount)}. Đang tạo biên lai…</>}
        onCancel={data.status === 'PENDING' ? () => cancel.mutate(data.id) : undefined}
        cancelling={cancel.isPending}
      />
      {data.status !== 'PENDING' && data.status !== 'PAID' && (
        <div className="mt-2 flex justify-center gap-2">
          <Button type="primary" onClick={onBack}>
            Quay lại đơn để thu lại
          </Button>
          <Button onClick={onFinished}>Hủy đơn này</Button>
        </div>
      )}
      {data.status === 'PENDING' && (
        <div className="mt-4 text-xs text-sc-muted-2">
          Khách đổi ý? Bấm “Hủy hóa đơn” rồi quay lại chọn cách thu khác. Rời màn hình này thì hệ thống ngừng kiểm tra
          trạng thái hóa đơn.
        </div>
      )}
    </Card>
  );
}

function CounterGuideSteps() {
  return (
    <Card className="overflow-hidden border border-sc-border bg-white shadow-xs">
      <div className="py-2">
        <div className="text-center max-w-xl mx-auto mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sc-paper text-xs font-semibold text-sc-ink border border-sc-border mb-2.5">
            <span className="size-2 rounded-full bg-emerald-600 animate-pulse" />
            Quy trình bán hàng tại quầy
          </div>
          <h3 className="m-0 font-display text-lg font-bold text-sc-ink">3 bước hoàn tất đơn hàng nhanh chóng</h3>
          <p className="mt-1 text-xs text-sc-muted">
            Vui lòng chọn thông tin khách hàng ở Bước 1 phía trên để kích hoạt danh mục dịch vụ và giỏ hàng.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {/* Bước 1 */}
          <div className="relative rounded-xl border border-sc-border bg-sc-paper/60 p-4 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="flex size-7 items-center justify-center rounded-lg bg-sc-ink text-xs font-bold text-sc-lime">
                1
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Đang thực hiện
              </span>
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <UserCheck className="size-4 text-sc-ink" />
              <h4 className="m-0 font-bold text-sm text-sc-ink">Chọn người mua</h4>
            </div>
            <p className="m-0 text-xs text-sc-muted leading-relaxed">
              Tìm kiếm hội viên bằng tên/SĐT hoặc chọn khách vãng lai để bắt đầu lập đơn.
            </p>
          </div>

          {/* Bước 2 */}
          <div className="relative rounded-xl border border-sc-border/60 bg-sc-paper/30 p-4 opacity-75">
            <div className="flex items-center justify-between mb-3">
              <span className="flex size-7 items-center justify-center rounded-lg bg-sc-muted/20 text-xs font-bold text-sc-muted">
                2
              </span>
              <span className="text-[11px] font-medium text-sc-muted">Chờ bước 1</span>
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <LayoutGrid className="size-4 text-sc-muted" />
              <h4 className="m-0 font-bold text-sm text-sc-ink">Thêm dịch vụ</h4>
            </div>
            <p className="m-0 text-xs text-sc-muted leading-relaxed">
              Đặt sân lẻ, mua gói sân định kỳ, ghi danh lớp thể thao hoặc đăng ký gói tập.
            </p>
          </div>

          {/* Bước 3 */}
          <div className="relative rounded-xl border border-sc-border/60 bg-sc-paper/30 p-4 opacity-75">
            <div className="flex items-center justify-between mb-3">
              <span className="flex size-7 items-center justify-center rounded-lg bg-sc-muted/20 text-xs font-bold text-sc-muted">
                3
              </span>
              <span className="text-[11px] font-medium text-sc-muted">Chờ bước 2</span>
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <CreditCard className="size-4 text-sc-muted" />
              <h4 className="m-0 font-bold text-sm text-sc-ink">Thu tiền & Xuất hóa đơn</h4>
            </div>
            <p className="m-0 text-xs text-sc-muted leading-relaxed">
              Áp dụng mã giảm giá, thu tiền mặt, quẹt thẻ POS hoặc tạo mã QR chuyển khoản.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function CounterOrderPage() {
  const user = useCurrentUser();
  const search = routeApi.useSearch();
  const queryClient = useQueryClient();
  const { store, cart } = useCounterDraft();
  const add = useAddToCart(store);
  const startTransfer = useStartCounterTransfer();
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [paidOrder, setPaidOrder] = useState<Order | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  // `?memberId=` pre-selects the buyer (opened from a member's profile). Only applies to an empty draft.
  const preselect = useQuery({
    queryKey: ['users', 'detail', search.memberId],
    queryFn: () => usersService.get(search.memberId!),
    enabled: Boolean(search.memberId) && !cart.buyer,
    retry: false,
  });
  useEffect(() => {
    if (preselect.data && !cart.buyer && preselect.data.role === 'MEMBER') {
      store.setBuyer({
        kind: 'MEMBER',
        accountId: preselect.data.id,
        fullName: preselect.data.fullName,
        phone: preselect.data.phone,
      });
    }
  }, [preselect.data, cart.buyer, store]);

  const buyer = buyerToApi(cart.buyer);
  const items = cart.lines.map((line) => line.selection);
  const isMember = cart.buyer?.kind === 'MEMBER';
  const quoteQuery = useQuote({ user, buyer, items, couponCodes: cart.couponCodes, enabled: Boolean(buyer) });
  const quote = cart.lines.length ? quoteQuery.data : undefined;

  const finishOrder = (order: Order) => {
    store.reset();
    setPaidOrder(order);
  };
  const checkout = useCheckout({
    onPaid: finishOrder,
    onQuote: (fresh) => queryClient.setQueryData(quoteQueryKey(user.id, buyer, items, cart.couponCodes), fresh),
  });

  const newOrder = () => {
    store.reset();
    setPaidOrder(null);
    setInvoiceId(null);
    setMethod('CASH');
  };

  const pay = (expectedTotal: number) => {
    if (!buyer) return;
    if (method === 'TRANSFER') {
      startTransfer.mutate(
        {
          buyer,
          items,
          couponCodes: cart.couponCodes,
          expectedTotal,
        },
        { onSuccess: (invoice) => setInvoiceId(invoice.id) },
      );
      return;
    }
    checkout.pay({ user, buyer, items, couponCodes: cart.couponCodes, paymentMethod: method, expectedTotal });
  };

  if (paidOrder) {
    return (
      <>
        <PageHeader title="Bán tại quầy" />
        <Receipt order={paidOrder} onNew={newOrder} />
      </>
    );
  }

  if (invoiceId) {
    return (
      <>
        <PageHeader title="Bán tại quầy" />
        <TransferPhase invoiceId={invoiceId} onBack={() => setInvoiceId(null)} onFinished={newOrder} />
      </>
    );
  }

  const busy = checkout.isPaying || startTransfer.isPending;
  const hasBuyer = Boolean(cart.buyer);

  return (
    <>
      <PageHeader
        title="Bán tại quầy"
        description="Một người mua, một đơn nhiều dịch vụ, một phương thức thanh toán. Mỗi tab trình duyệt có đơn nháp riêng."
        extra={
          (cart.lines.length > 0 || cart.buyer) && (
            <Popconfirm
              title="Bỏ đơn đang soạn?"
              okText="Bỏ đơn"
              cancelText="Giữ lại"
              okButtonProps={{ danger: true }}
              onConfirm={newOrder}
            >
              <Button danger>Bỏ đơn</Button>
            </Popconfirm>
          )
        }
      />
      <div className="flex flex-col gap-4">
        <CounterBuyerCard buyer={cart.buyer} onChange={store.setBuyer} balance={quote?.walletBalance} disabled={busy} />

        {!hasBuyer ? (
          <CounterGuideSteps />
        ) : (
          <>
            <CounterServicePicker
              user={user}
              buyer={buyer!}
              isMember={isMember}
              onAdd={(selection) => void add(selection)}
            />

            <Card>
              <SectionTitle>3. Đơn hàng và thu tiền ({cart.lines.length} dịch vụ)</SectionTitle>
              {cart.lines.length === 0 ? (
                <p className="m-0 text-sc-muted">Chưa có dịch vụ nào. Thêm đặt sân, lớp hoặc gói ở bước 2.</p>
              ) : (
                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="flex min-w-0 flex-col gap-4">
                    {quoteQuery.isError && <Alert type="error" showIcon title={toApiError(quoteQuery.error).message} />}
                    <QuoteLines
                      lines={cart.lines}
                      quote={quote}
                      pricing={quoteQuery.isFetching && !quote}
                      onRemove={store.remove}
                      disabled={busy}
                    />
                    {isMember && (
                      <CouponInput
                        codes={cart.couponCodes}
                        quote={quote}
                        check={(couponCodes) => checkoutService.quote({ buyer, items, couponCodes })}
                        onAdd={store.addCoupon}
                        onRemove={store.removeCoupon}
                        disabled={busy}
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-3">
                    {quote ? (
                      <>
                        <QuoteTotals quote={quote} />
                        <div>
                          <div className="mb-1.5 font-semibold">Phương thức thanh toán</div>
                          <Radio.Group
                            optionType="button"
                            buttonStyle="solid"
                            value={method}
                            disabled={busy}
                            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                            options={METHODS.map((value) => ({ value, label: PAYMENT_METHOD_LABEL[value] }))}
                          />
                        </div>
                        <Button
                          type="primary"
                          size="large"
                          block
                          loading={busy}
                          disabled={
                            !quote.canCheckout || quoteQuery.isFetching || (method === 'TRANSFER' && quote.total === 0)
                          }
                          onClick={() => pay(quote.total)}
                        >
                          {method === 'TRANSFER' ? 'Tạo hóa đơn chuyển khoản' : 'Thu tiền'} · {formatVND(quote.total)}
                        </Button>
                        {!quote.canCheckout && (
                          <p className="m-0 text-xs text-sc-error">{blockedReason(quote)} để thu tiền.</p>
                        )}
                        {method === 'TRANSFER' && quote.total === 0 && (
                          <p className="m-0 text-xs text-sc-muted">
                            Đơn 0đ không cần chuyển khoản, hãy chọn tiền mặt hoặc thẻ.
                          </p>
                        )}
                        <p className="m-0 text-xs text-sc-muted-2">
                          Thu tiền mặt / thẻ ghi nhận ngay và không trừ ví khách. Hệ thống kiểm tra lại toàn bộ đơn khi
                          thu.
                        </p>
                      </>
                    ) : (
                      <p className="m-0 text-sc-muted">Đang tính giá…</p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
      <PriceChangeModal
        change={checkout.priceChange}
        confirming={checkout.isPaying}
        onConfirm={(fresh) => pay(fresh.total)}
        onCancel={checkout.dismissPriceChange}
      />
    </>
  );
}
