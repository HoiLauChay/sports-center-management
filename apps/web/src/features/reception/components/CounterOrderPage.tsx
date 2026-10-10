import type { PaymentMethod } from '@sports-center/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { Alert, Button, Card, Popconfirm, Radio, Result } from 'antd';
import { Printer } from 'lucide-react';
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
          <Alert type="info" showIcon title="Chọn người mua trước, sau đó thêm dịch vụ vào đơn." />
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
