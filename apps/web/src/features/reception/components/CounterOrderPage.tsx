import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { Alert, Button, Popconfirm } from 'antd';
import { CheckCircle2, Printer, UserSearch } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { PageLoading } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { PAYMENT_METHOD_LABEL } from '~/constants/payment';
import { useCurrentUser } from '~/features/auth';
import { PriceChangeModal } from '~/features/checkout/components/PriceChangeModal';
import { useAddToCart } from '~/features/checkout/hooks/useAddToCart';
import { quoteQueryKey, useCounterDraft, useQuote } from '~/features/checkout/hooks/useCart';
import { useCheckout } from '~/features/checkout/hooks/useCheckout';
import { checkoutService } from '~/features/checkout/services/checkout.service';
import type { Order } from '~/features/checkout/types';
import { blockedReason, selectionKey } from '~/features/checkout/utils';
import { InvoiceSheet } from '~/features/orders/components/InvoiceSheet';
import { useOrder } from '~/features/orders/hooks/useOrders';
import { usersService } from '~/features/users/services/users.service';
import { InvoicePayPanel } from '~/features/wallet';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import {
  buyerToApi,
  useCancelCounterInvoice,
  useCounterInvoice,
  useMemberMemberships,
  useStartCounterTransfer,
} from '../hooks/useCounter';
import { useCounterHotkeys } from '../hooks/useCounterHotkeys';
import { CUSTOMER_SEARCH_ID, memberToBuyer } from '../utils';
import { CounterCartPanel } from './CounterCartPanel';
import { CounterCustomerBar } from './CounterCustomerBar';
import { CounterCustomerSearch } from './CounterCustomerSearch';
import { CounterPaymentPanel, type CounterMethod } from './CounterPaymentPanel';
import { CounterServicePicker, type CounterServiceTab } from './CounterServicePicker';

const routeApi = getRouteApi('/_authenticated/_receptionist/reception/order');

const METHODS: CounterMethod[] = ['CASH', 'CARD', 'TRANSFER'];

/** Whether any part of the element is on screen (the stacked layout hides the bottom bar once the cart shows). */
function useInView(ref: RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), {
      rootMargin: '0px 0px -120px 0px',
    });
    observer.observe(element);
    return () => observer.disconnect();
  });
  return visible;
}

const focusCustomerSearch = () => window.setTimeout(() => document.getElementById(CUSTOMER_SEARCH_ID)?.focus(), 0);

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-sc-border-soft py-2 last:border-b-0">
      <span className="text-[15px] text-sc-muted">{label}</span>
      <span className={`tabular-nums ${strong ? 'font-display text-[22px] font-extrabold' : 'font-semibold'}`}>
        {value}
      </span>
    </div>
  );
}

/** Paid: a short summary (with the change to hand back), print, and a "next customer" button focused for Enter. */
function Receipt({ order, tendered, onNew }: { order: Order; tendered: number | null; onNew: () => void }) {
  const customer = order.account?.fullName ?? order.guestName ?? 'Khách lẻ';
  const cash = order.paymentMethod === 'CASH' && tendered !== null && tendered > order.totalAmount;
  return (
    <>
      <div className="no-print mx-auto flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl border border-sc-border bg-white px-6 py-8 text-center shadow-xs">
        <CheckCircle2 size={52} className="text-sc-success" />
        <div>
          <h2 className="m-0 font-display text-[26px] font-extrabold text-sc-ink uppercase">Đã thu tiền</h2>
          <p className="m-0 text-sc-muted">
            Hóa đơn <b className="text-sc-ink">{order.orderNumber}</b>
          </p>
        </div>
        <div className="w-full text-left">
          <SummaryRow label="Khách hàng" value={customer} />
          <SummaryRow label="Dịch vụ" value={`${order.items.length} dịch vụ`} />
          <SummaryRow label="Thanh toán" value={PAYMENT_METHOD_LABEL[order.paymentMethod]} />
          <SummaryRow label="Tổng tiền" value={formatVND(order.totalAmount)} strong />
          {cash && (
            <>
              <SummaryRow label="Khách đưa" value={formatVND(tendered)} />
              <div className="mt-2 flex items-baseline justify-between gap-4 rounded-lg bg-sc-accent-soft px-3 py-2.5">
                <span className="font-semibold text-sc-accent">Tiền thối lại</span>
                <span className="font-display text-[28px] font-extrabold tabular-nums text-sc-accent">
                  {formatVND(tendered - order.totalAmount)}
                </span>
              </div>
            </>
          )}
        </div>
        <Button type="primary" size="large" block autoFocus onClick={onNew} className="!h-12 !font-bold">
          Khách tiếp theo
        </Button>
        <div className="flex flex-wrap justify-center gap-2">
          <Button icon={<Printer size={16} />} onClick={() => window.print()}>
            In biên lai
          </Button>
          <Link to="/reception/orders/$orderId" params={{ orderId: order.id }}>
            <Button>Xem hóa đơn</Button>
          </Link>
        </div>
      </div>
      <InvoiceSheet order={order} />
    </>
  );
}

/** Pay-by-transfer phase: QR of the invoice, live status, back to the draft, and the receipt once the money arrived. */
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

  if (paid && orderQuery.data) return <Receipt order={orderQuery.data} tendered={null} onNew={onFinished} />;

  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-sc-border bg-white px-6 py-6 shadow-xs">
      <InvoicePayPanel
        layout="counter"
        invoice={data}
        paidMessage={<>Đã nhận {formatVND(data.amount)}. Đang tạo biên lai…</>}
        onCancel={data.status === 'PENDING' ? () => cancel.mutate(data.id, { onSuccess: onBack }) : undefined}
        cancelling={cancel.isPending}
      />
      {data.status !== 'PENDING' && data.status !== 'PAID' && (
        <div className="mt-2 flex justify-center gap-2">
          <Button type="primary" size="large" onClick={onBack}>
            Quay lại đơn để thu lại
          </Button>
          <Button size="large" onClick={onFinished}>
            Hủy đơn này
          </Button>
        </div>
      )}
    </div>
  );
}

export function CounterOrderPage() {
  const user = useCurrentUser();
  const search = routeApi.useSearch();
  const queryClient = useQueryClient();
  const { store, cart } = useCounterDraft();
  const add = useAddToCart(store);
  const startTransfer = useStartCounterTransfer();
  const [method, setMethod] = useState<CounterMethod>('CASH');
  const [cash, setCash] = useState<{ total: number; value: number } | null>(null);
  const [tab, setTab] = useState<CounterServiceTab>('slot');
  const [paid, setPaid] = useState<{ order: Order; tendered: number | null } | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const cartRef = useRef<HTMLElement>(null);
  const cartVisible = useInView(cartRef);

  // `?memberId=` pre-selects the buyer (opened from a member's profile). Only applies to an empty draft.
  const preselect = useQuery({
    queryKey: ['users', 'detail', search.memberId],
    queryFn: () => usersService.get(search.memberId!),
    enabled: Boolean(search.memberId) && !cart.buyer,
    retry: false,
  });
  useEffect(() => {
    if (preselect.data && !cart.buyer && preselect.data.role === 'MEMBER')
      store.setBuyer(memberToBuyer(preselect.data));
  }, [preselect.data, cart.buyer, store]);

  const buyer = buyerToApi(cart.buyer);
  const items = cart.lines.map((line) => line.selection);
  const isMember = cart.buyer?.kind === 'MEMBER';
  const quoteQuery = useQuote({ user, buyer, items, couponCodes: cart.couponCodes, enabled: Boolean(buyer) });
  const quote = cart.lines.length ? quoteQuery.data : undefined;
  const memberships = useMemberMemberships(cart.buyer?.kind === 'MEMBER' ? cart.buyer.accountId : undefined);
  const inCart = useMemo(() => new Set(cart.lines.map((line) => selectionKey(line.selection))), [cart.lines]);

  // Cash handed over belongs to one total: once the total changes it no longer applies.
  const tendered = cash && cash.total === quote?.total ? cash.value : null;
  const setTendered = (value: number | null) =>
    setCash(value === null || quote === undefined ? null : { total: quote.total, value });
  const paidTendered = useRef<number | null>(null);

  const checkout = useCheckout({
    onPaid: (order) => {
      store.reset();
      setPaid({ order, tendered: paidTendered.current });
      window.scrollTo({ top: 0 });
    },
    onQuote: (fresh) => queryClient.setQueryData(quoteQueryKey(user.id, buyer, items, cart.couponCodes), fresh),
  });

  const newOrder = () => {
    store.reset();
    setPaid(null);
    setInvoiceId(null);
    setMethod('CASH');
    setCash(null);
    setTab('slot');
    focusCustomerSearch();
  };

  const busy = checkout.isPaying || startTransfer.isPending;
  const short = method === 'CASH' && tendered !== null && quote !== undefined && tendered < quote.total;
  const canPay =
    Boolean(quote?.canCheckout) &&
    !quoteQuery.isFetching &&
    !busy &&
    !short &&
    !(method === 'TRANSFER' && quote?.total === 0) &&
    !checkout.priceChange;

  const pay = (expectedTotal: number) => {
    if (!buyer) return;
    paidTendered.current = method === 'CASH' ? tendered : null;
    if (method === 'TRANSFER') {
      startTransfer.mutate(
        { buyer, items, couponCodes: cart.couponCodes, expectedTotal },
        {
          onSuccess: (invoice) => {
            setInvoiceId(invoice.id);
            window.scrollTo({ top: 0 });
          },
        },
      );
      return;
    }
    checkout.pay({ user, buyer, items, couponCodes: cart.couponCodes, paymentMethod: method, expectedTotal });
  };

  const counterActive = !paid && !invoiceId;
  useCounterHotkeys({
    onSearch: counterActive
      ? () => {
          if (cart.buyer && cart.lines.length) return;
          store.setBuyer(null);
          focusCustomerSearch();
        }
      : undefined,
    onPay: counterActive && canPay && quote ? () => pay(quote.total) : undefined,
    onMethod: counterActive && quote ? (index) => setMethod(METHODS[index]!) : undefined,
  });

  if (paid) {
    return (
      <>
        <PageHeader title="Bán tại quầy" />
        <Receipt order={paid.order} tendered={paid.tendered} onNew={newOrder} />
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

  const header = (
    <PageHeader
      title="Bán tại quầy"
      extra={
        (cart.lines.length > 0 || cart.buyer) && (
          <Popconfirm
            title="Bỏ đơn đang soạn?"
            description="Khách và các dịch vụ đã chọn sẽ bị xóa."
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
  );

  if (!cart.buyer) {
    return (
      <>
        {header}
        <section className="mx-auto mt-4 flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-sc-border bg-white px-6 py-7 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-sc-primary text-sc-lime">
              <UserSearch size={22} />
            </span>
            <div>
              <h2 className="m-0 font-display text-[22px] font-extrabold text-sc-ink uppercase">Khách hàng</h2>
              <p className="m-0 text-[14.5px] text-sc-muted">
                Tìm hội viên hoặc bán cho khách vãng lai để bắt đầu đơn.
              </p>
            </div>
          </div>
          {preselect.isFetching ? <PageLoading /> : <CounterCustomerSearch disabled={busy} onSelect={store.setBuyer} />}
        </section>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <CounterCustomerBar
            buyer={cart.buyer}
            hasLines={cart.lines.length > 0}
            disabled={busy}
            onClear={() => {
              store.setBuyer(null);
              focusCustomerSearch();
            }}
            onAdd={(selection) => void add(selection)}
            onBrowseMemberships={() => setTab('membership')}
          />
          <CounterServicePicker
            user={user}
            buyer={buyer!}
            isMember={isMember}
            tab={tab}
            onTab={setTab}
            inCart={inCart}
            currentPackageId={memberships.data?.current?.package.id}
            onAdd={(selection) => void add(selection)}
          />
        </div>

        <aside ref={cartRef} className="xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
          <CounterCartPanel
            lines={cart.lines}
            quote={quote}
            quoteError={quoteQuery.isError ? toApiError(quoteQuery.error).message : undefined}
            pricing={quoteQuery.isFetching && !quote}
            disabled={busy}
            onRemove={store.remove}
            coupons={
              isMember
                ? {
                    codes: cart.couponCodes,
                    check: (couponCodes) => checkoutService.quote({ buyer, items, couponCodes }),
                    onAdd: store.addCoupon,
                    onRemove: store.removeCoupon,
                  }
                : undefined
            }
          >
            {quote && (
              <CounterPaymentPanel
                total={quote.total}
                method={method}
                onMethod={setMethod}
                tendered={tendered}
                onTendered={setTendered}
                canPay={canPay}
                blockedReason={quote.canCheckout ? undefined : `${blockedReason(quote)} để thu tiền.`}
                busy={busy}
                onPay={() => pay(quote.total)}
              />
            )}
          </CounterCartPanel>
        </aside>
      </div>

      {cart.lines.length > 0 && !cartVisible && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex items-center justify-between gap-3 border-t border-sc-border bg-white/95 px-4 py-3 backdrop-blur xl:hidden">
          <div className="flex flex-col leading-tight">
            <span className="text-[13.5px] text-sc-muted">{cart.lines.length} dịch vụ · Phải trả</span>
            <b className="font-display text-[22px] tabular-nums">{quote ? formatVND(quote.total) : '…'}</b>
          </div>
          <Button
            type="primary"
            size="large"
            onClick={() => cartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
          >
            Thanh toán
          </Button>
        </div>
      )}

      <PriceChangeModal
        change={checkout.priceChange}
        confirming={checkout.isPaying}
        onConfirm={(fresh) => pay(fresh.total)}
        onCancel={checkout.dismissPriceChange}
      />
    </>
  );
}
