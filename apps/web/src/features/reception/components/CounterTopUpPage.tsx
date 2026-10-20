import type { WalletTransaction } from '@sports-center/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { Alert, App, Button, Input, Skeleton } from 'antd';
import { ArrowRight, CheckCircle2, History, Wallet, WalletCards } from 'lucide-react';
import { useRef, useState } from 'react';
import { PageLoading } from '~/components/feedback/States';
import { MoneyInput } from '~/components/form/MoneyInput';
import { PageHeader } from '~/components/ui/PageHeader';
import { PAYMENT_METHOD_LABEL, WALLET_TX_TAG } from '~/constants/payment';
import type { DraftBuyer } from '~/features/checkout/store/cartStore';
import { useSettings } from '~/features/settings';
import { usersService } from '~/features/users/services/users.service';
import { useInvoice, useMemberWallet, useRefreshAfterPaid, walletService } from '~/features/wallet';
import { formatRelative, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useCounterHotkeys } from '../hooks/useCounterHotkeys';
import { CUSTOMER_SEARCH_ID, memberToBuyer } from '../utils';
import { CounterCustomerSearch, CustomerAvatar } from './CounterCustomerSearch';
import { CounterInvoicePanel } from './CounterInvoicePanel';
import { CounterPaymentPanel, type CounterMethod } from './CounterPaymentPanel';

const routeApi = getRouteApi('/_authenticated/_receptionist/reception/top-up');

type Member = Extract<DraftBuyer, { kind: 'MEMBER' }>;

const PRESET_AMOUNTS = [100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000];
const METHODS: CounterMethod[] = ['CASH', 'CARD', 'TRANSFER'];

const focusSearch = () => window.setTimeout(() => document.getElementById(CUSTOMER_SEARCH_ID)?.focus(), 0);

interface Done {
  amount: number;
  method: CounterMethod;
  balanceAfter: number | null;
  tendered: number | null;
}

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

function TopUpDone({
  member,
  done,
  onNext,
  onAgain,
}: {
  member: Member;
  done: Done;
  onNext: () => void;
  onAgain: () => void;
}) {
  const change = done.method === 'CASH' && done.tendered !== null ? done.tendered - done.amount : 0;
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl border border-sc-border bg-white px-6 py-8 text-center shadow-xs">
      <CheckCircle2 size={52} className="text-sc-success" />
      <div>
        <h2 className="m-0 font-display text-[26px] font-extrabold text-sc-ink uppercase">Đã nạp ví</h2>
        <p className="m-0 text-sc-muted">
          cho <b className="text-sc-ink">{member.fullName}</b>
        </p>
      </div>
      <div className="w-full text-left">
        <SummaryRow label="Số tiền nạp" value={formatVND(done.amount)} strong />
        <SummaryRow label="Hình thức" value={PAYMENT_METHOD_LABEL[done.method]} />
        <SummaryRow label="Số dư mới" value={done.balanceAfter === null ? '…' : formatVND(done.balanceAfter)} />
        {change > 0 && (
          <div className="mt-2 flex items-baseline justify-between gap-4 rounded-lg bg-sc-accent-soft px-3 py-2.5">
            <span className="font-semibold text-sc-accent">Tiền thối lại</span>
            <span className="font-display text-[28px] font-extrabold tabular-nums text-sc-accent">
              {formatVND(change)}
            </span>
          </div>
        )}
      </div>
      <Button type="primary" size="large" block autoFocus onClick={onNext} className="!h-12 !font-bold">
        Khách tiếp theo
      </Button>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onAgain}>Nạp thêm cho khách này</Button>
        <Link to="/reception/order" search={{ memberId: member.accountId }}>
          <Button>Bán dịch vụ cho khách này</Button>
        </Link>
      </div>
    </div>
  );
}

/** Pay-by-transfer: large QR for the customer, then back to the form or on to the "done" screen. */
function TransferPhase({ invoiceId, onPaid, onBack }: { invoiceId: string; onPaid: () => void; onBack: () => void }) {
  const invoice = useInvoice(invoiceId);
  useRefreshAfterPaid(invoice.data, onPaid);
  if (!invoice.data) return <PageLoading />;
  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-sc-border bg-white px-6 py-6 shadow-xs">
      <CounterInvoicePanel
        invoice={invoice.data}
        paidMessage={`Đã nhận ${formatVND(invoice.data.amount)}. Ví thành viên đã được cộng.`}
      />
      <div className="mt-2 flex justify-center">
        <Button size="large" onClick={onBack}>
          {invoice.data.status === 'PENDING' ? 'Quay lại (hóa đơn tự hết hạn nếu khách không chuyển)' : 'Quay lại'}
        </Button>
      </div>
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: WalletTransaction }) {
  const tag = WALLET_TX_TAG[transaction.type];
  const incoming = transaction.type !== 'PAYMENT';
  return (
    <li className="flex items-center gap-3 border-b border-sc-border-soft py-2.5 last:border-b-0">
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-[15px] font-semibold text-sc-ink">
          {tag.label}
          {transaction.method && (
            <span className="font-normal text-sc-muted"> · {PAYMENT_METHOD_LABEL[transaction.method]}</span>
          )}
        </span>
        <span className="text-[13.5px] text-sc-muted">{formatRelative(transaction.createdAt)}</span>
      </span>
      <span className="flex flex-col items-end leading-tight">
        <b className={`tabular-nums ${incoming ? 'text-sc-success' : 'text-sc-ink'}`}>
          {incoming ? '+' : '−'}
          {formatVND(transaction.amount)}
        </b>
        <span className="text-[13.5px] text-sc-muted tabular-nums">còn {formatVND(transaction.balanceAfter)}</span>
      </span>
    </li>
  );
}

/** `/reception/top-up`: cash / card top-ups are recorded at once; transfer shows a QR for the customer. */
export function CounterTopUpPage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const settings = useSettings();
  const minAmount = settings.data?.topUpMinAmount ?? 10_000;

  const [picked, setPicked] = useState<Member | null>(null);
  const [amount, setAmount] = useState<number | null>(500_000);
  const [method, setMethod] = useState<CounterMethod>('CASH');
  const [cash, setCash] = useState<{ amount: number; value: number } | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const keyRef = useRef<{ fingerprint: string; key: string } | null>(null);

  const memberId = picked?.accountId ?? search.memberId;
  const detail = useQuery({
    queryKey: ['users', 'detail', memberId],
    queryFn: () => usersService.get(memberId!),
    enabled: Boolean(memberId) && !picked,
    staleTime: 60_000,
  });
  const member = picked ?? (detail.data?.role === 'MEMBER' ? (memberToBuyer(detail.data) as Member) : null);
  const wallet = useMemberWallet(member?.accountId, { page: 1, limit: 6 });
  const balance = wallet.data?.balance;

  const tendered = cash && cash.amount === amount ? cash.value : null;
  const amountValue = amount !== null && Number.isFinite(amount) && amount >= minAmount ? amount : null;
  const valid = amountValue !== null;

  const selectMember = (next: Member | null) => {
    setPicked(next);
    setDone(null);
    setInvoiceId(null);
    setError(undefined);
    setCash(null);
    setNote('');
    void navigate({ search: { memberId: next?.accountId }, replace: true });
    if (!next) focusSearch();
  };

  const record = useMutation({
    mutationFn: (input: {
      amount: number;
      method: 'CASH' | 'CARD';
      note: string;
      key: string;
      tendered: number | null;
    }) =>
      walletService.counterTopUp(member!.accountId, {
        amount: input.amount,
        method: input.method,
        note: input.note || undefined,
        idempotencyKey: input.key,
      }),
    onSuccess: (transaction, input) => {
      keyRef.current = null;
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      setDone({
        amount: transaction.amount,
        method: input.method,
        balanceAfter: transaction.balanceAfter,
        tendered: input.method === 'CASH' ? input.tendered : null,
      });
      setNote('');
      window.scrollTo({ top: 0 });
    },
    onError: (err) => message.error(toApiError(err).message),
  });

  const createInvoice = useMutation({
    mutationFn: (value: number) => walletService.createTopUp({ accountId: member?.accountId, amount: value }),
    onSuccess: (invoice) => {
      setInvoiceId(invoice.id);
      window.scrollTo({ top: 0 });
    },
    onError: (err) => {
      const apiError = toApiError(err);
      setError(apiError.errors?.[0]?.message ?? apiError.message);
    },
  });

  const busy = record.isPending || createInvoice.isPending;

  const submit = () => {
    if (busy || !member) return;
    if (amount === null || !Number.isFinite(amount)) return setError('Vui lòng nhập số tiền');
    if (amount < minAmount) return setError(`Số tiền nạp tối thiểu là ${formatVND(minAmount)}`);
    setError(undefined);
    if (method === 'TRANSFER') {
      createInvoice.mutate(amount);
      return;
    }
    const fingerprint = JSON.stringify([member.accountId, amount, method, note]);
    if (keyRef.current?.fingerprint !== fingerprint) keyRef.current = { fingerprint, key: crypto.randomUUID() };
    record.mutate({ amount, method, note, key: keyRef.current.key, tendered });
  };

  const counterActive = Boolean(member) && !done && !invoiceId;
  useCounterHotkeys({
    onSearch: counterActive || !member ? () => selectMember(null) : undefined,
    onPay: counterActive && valid && !busy ? submit : undefined,
    onMethod: counterActive ? (index) => setMethod(METHODS[index]!) : undefined,
  });

  if (member && done) {
    return (
      <>
        <PageHeader title="Nạp ví tại quầy" />
        <TopUpDone
          member={member}
          done={{ ...done, balanceAfter: done.balanceAfter ?? balance ?? null }}
          onNext={() => selectMember(null)}
          onAgain={() => setDone(null)}
        />
      </>
    );
  }

  if (member && invoiceId) {
    return (
      <>
        <PageHeader title="Nạp ví tại quầy" />
        <TransferPhase
          invoiceId={invoiceId}
          onBack={() => setInvoiceId(null)}
          onPaid={() => {
            setInvoiceId(null);
            setDone({ amount: amount ?? 0, method: 'TRANSFER', balanceAfter: null, tendered: null });
          }}
        />
      </>
    );
  }

  if (!member) {
    return (
      <>
        <PageHeader title="Nạp ví tại quầy" />
        <section className="mx-auto mt-4 flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-sc-border bg-white px-6 py-7 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-sc-primary text-sc-lime">
              <WalletCards size={22} />
            </span>
            <div>
              <h2 className="m-0 font-display text-[22px] font-extrabold text-sc-ink uppercase">Nạp ví cho ai?</h2>
              <p className="m-0 text-[14.5px] text-sc-muted">Chỉ hội viên có tài khoản mới có ví.</p>
            </div>
          </div>
          {memberId && detail.isFetching ? (
            <PageLoading />
          ) : (
            <CounterCustomerSearch
              allowGuest={false}
              placeholder="Nhập SĐT, tên hoặc email hội viên"
              hint="Chọn hội viên để xem số dư và nạp tiền."
              onSelect={(buyer) => buyer.kind === 'MEMBER' && selectMember(buyer)}
            />
          )}
        </section>
      </>
    );
  }

  const after = balance !== undefined && amountValue !== null ? balance + amountValue : undefined;

  return (
    <>
      <PageHeader title="Nạp ví tại quầy" />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4 xl:col-start-1">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-sc-border bg-white px-4 py-3 shadow-xs">
            <div className="flex min-w-0 items-center gap-3">
              <CustomerAvatar name={member.fullName} />
              <div className="flex min-w-0 flex-col leading-tight">
                <b className="truncate text-[16px] text-sc-ink">{member.fullName}</b>
                {member.phone && <span className="text-[14.5px] text-sc-muted tabular-nums">{member.phone}</span>}
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[12.5px] font-semibold tracking-[0.06em] text-sc-muted uppercase">
                Số dư hiện tại
              </span>
              <span className="inline-flex items-center gap-1.5 font-display text-[22px] font-extrabold tabular-nums text-sc-ink">
                <Wallet size={18} className="text-sc-muted" />
                {balance === undefined ? '…' : formatVND(balance)}
              </span>
            </div>
            <Button className="ml-auto" disabled={busy} onClick={() => selectMember(null)}>
              Đổi khách
            </Button>
          </div>

          <section className="rounded-xl border border-sc-border bg-white px-4 py-4 shadow-xs">
            <h2 className="mt-0 mb-3 font-display text-[17px] font-bold tracking-[0.04em] text-sc-ink uppercase">
              Số tiền nạp
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PRESET_AMOUNTS.map((value) => {
                const active = amount === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    disabled={busy}
                    onClick={() => {
                      setAmount(value);
                      setError(undefined);
                    }}
                    className={`h-14 cursor-pointer rounded-lg border font-display text-[20px] font-bold tabular-nums transition-colors disabled:cursor-not-allowed ${
                      active
                        ? 'border-sc-primary bg-sc-primary-soft text-sc-primary shadow-[inset_0_0_0_1px_var(--sc-primary)]'
                        : 'border-sc-border bg-white text-sc-ink hover:border-sc-primary-border'
                    }`}
                  >
                    {formatVND(value)}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <div className="mb-1.5 text-[14.5px] font-semibold text-sc-ink-2">Hoặc nhập số khác</div>
                <MoneyInput
                  value={amount}
                  step={50_000}
                  size="large"
                  disabled={busy}
                  status={error ? 'error' : undefined}
                  onChange={(value) => {
                    setAmount(value);
                    setError(undefined);
                  }}
                />
                <div className={`mt-1 text-[13.5px] ${error ? 'text-sc-error' : 'text-sc-muted'}`}>
                  {error ?? `Tối thiểu ${formatVND(minAmount)}`}
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-sc-paper px-4 py-3 sm:mt-6">
                <span className="flex flex-col leading-tight">
                  <span className="text-[12.5px] font-semibold text-sc-muted uppercase">Hiện tại</span>
                  <b className="tabular-nums">{balance === undefined ? '…' : formatVND(balance)}</b>
                </span>
                <ArrowRight size={16} className="text-sc-muted" />
                <span className="flex flex-col leading-tight">
                  <span className="text-[12.5px] font-semibold text-sc-muted uppercase">Sau khi nạp</span>
                  <b className="tabular-nums text-sc-success">{after === undefined ? '—' : formatVND(after)}</b>
                </span>
              </div>
            </div>
          </section>
        </div>

        <aside className="rounded-xl border border-sc-border bg-white px-4 py-4 shadow-xs xl:sticky xl:top-20 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <span className="font-semibold text-sc-ink">Thu của khách</span>
            <span className="font-display text-[30px] leading-none font-extrabold tabular-nums text-sc-ink">
              {formatVND(amountValue ?? 0)}
            </span>
          </div>
          <CounterPaymentPanel
            total={amountValue ?? 0}
            method={method}
            onMethod={setMethod}
            tendered={tendered}
            onTendered={(value) =>
              setCash(value === null || amountValue === null ? null : { amount: amountValue, value })
            }
            canPay={valid}
            blockedReason={`Số tiền nạp tối thiểu là ${formatVND(minAmount)}`}
            busy={busy}
            onPay={submit}
            actionLabel={(value) =>
              value === 'TRANSFER' ? 'Tạo mã QR' : value === 'CARD' ? 'Xác nhận đã quẹt thẻ' : 'Xác nhận đã thu'
            }
            hints={{ TRANSFER: 'Khách quét mã QR để tự chuyển khoản. Ví được cộng ngay khi tiền về.' }}
          >
            {method !== 'TRANSFER' && (
              <Input
                value={note}
                maxLength={200}
                disabled={busy}
                placeholder="Ghi chú (không bắt buộc)"
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </CounterPaymentPanel>
        </aside>

        <section className="min-w-0 rounded-xl border border-sc-border bg-white px-4 py-3 shadow-xs xl:col-start-1">
          <h2 className="mt-0 mb-1 flex items-center gap-2 font-display text-[17px] font-bold tracking-[0.04em] text-sc-ink uppercase">
            <History size={17} />
            Giao dịch gần đây
          </h2>
          {wallet.isPending ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : wallet.isError ? (
            <Alert type="error" showIcon title={toApiError(wallet.error).message} />
          ) : wallet.data?.transactions.items.length ? (
            <ul className="m-0 list-none p-0">
              {wallet.data.transactions.items.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </ul>
          ) : (
            <p className="my-3 text-[14.5px] text-sc-muted">Ví chưa có giao dịch nào.</p>
          )}
        </section>
      </div>
    </>
  );
}
