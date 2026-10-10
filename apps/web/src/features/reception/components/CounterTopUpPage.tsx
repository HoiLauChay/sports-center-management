import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Alert, App, Button, Card, Form, Input, Radio, Result } from 'antd';
import { useRef, useState } from 'react';
import { MemberSelect } from '~/components/form/MemberSelect';
import { MoneyInput } from '~/components/form/MoneyInput';
import { PageHeader } from '~/components/ui/PageHeader';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { WalletCard } from '~/components/ui/WalletCard';
import { PAYMENT_METHOD_LABEL } from '~/constants/payment';
import { useSettings } from '~/features/settings';
import {
  InvoicePayPanel,
  WalletTransactionsTable,
  useInvoice,
  useMemberWallet,
  useRefreshAfterPaid,
  walletService,
} from '~/features/wallet';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';

const routeApi = getRouteApi('/_authenticated/_receptionist/reception/top-up');

type TopUpMethod = 'CASH' | 'CARD' | 'TRANSFER';
const METHODS: TopUpMethod[] = ['CASH', 'CARD', 'TRANSFER'];

function TransferInvoice({ invoiceId, onDone }: { invoiceId: string; onDone: () => void }) {
  const { message } = App.useApp();
  const invoice = useInvoice(invoiceId);
  useRefreshAfterPaid(invoice.data, (paid) =>
    message.success(`Đã nhận ${formatVND(paid.amount)}, ví thành viên đã được cộng.`),
  );
  if (!invoice.data) return <p className="m-0 text-sc-muted">Đang tải hóa đơn…</p>;
  return (
    <>
      <InvoicePayPanel
        invoice={invoice.data}
        paidMessage={`Đã nhận ${formatVND(invoice.data.amount)}. Ví thành viên đã được cộng.`}
        paidActions={
          <Button type="primary" onClick={onDone}>
            Nạp cho khách khác
          </Button>
        }
      />
      {invoice.data.status !== 'PENDING' && invoice.data.status !== 'PAID' && (
        <div className="mt-2 text-center">
          <Button onClick={onDone}>Tạo yêu cầu nạp mới</Button>
        </div>
      )}
    </>
  );
}

/** `/reception/top-up`: cash / card top-ups are recorded at once; transfer creates a top-up invoice with a QR. */
export function CounterTopUpPage() {
  const search = routeApi.useSearch();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const settings = useSettings();
  const minAmount = settings.data?.topUpMinAmount ?? 10_000;
  const [memberId, setMemberId] = useState<string | undefined>(search.memberId);
  const [amount, setAmount] = useState<number | null>(500_000);
  const [method, setMethod] = useState<TopUpMethod>('CASH');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const keyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const wallet = useMemberWallet(memberId, { page: 1, limit: 8 });

  const refreshWallet = () => void queryClient.invalidateQueries({ queryKey: ['wallet'] });

  const record = useMutation({
    mutationFn: (input: { amount: number; method: 'CASH' | 'CARD'; note: string; key: string }) =>
      walletService.counterTopUp(memberId!, {
        amount: input.amount,
        method: input.method,
        note: input.note || undefined,
        idempotencyKey: input.key,
      }),
    onSuccess: (transaction) => {
      keyRef.current = null;
      refreshWallet();
      setDone(
        `Đã nạp ${formatVND(transaction.amount)} (${PAYMENT_METHOD_LABEL[transaction.method ?? 'CASH']}) vào ví.`,
      );
      setNote('');
    },
    onError: (err) => message.error(toApiError(err).message),
  });

  const createInvoice = useMutation({
    mutationFn: (value: number) => walletService.createTopUp({ accountId: memberId, amount: value }),
    onSuccess: (invoice) => setInvoiceId(invoice.id),
    onError: (err) => {
      const apiError = toApiError(err);
      setError(apiError.errors?.[0]?.message ?? apiError.message);
    },
  });

  const submit = () => {
    if (record.isPending || createInvoice.isPending || !memberId) return;
    if (amount === null || !Number.isFinite(amount)) return setError('Vui lòng nhập số tiền');
    if (amount < minAmount) return setError(`Số tiền nạp tối thiểu là ${formatVND(minAmount)}`);
    setError(undefined);
    setDone(null);
    if (method === 'TRANSFER') {
      createInvoice.mutate(amount);
      return;
    }
    const fingerprint = JSON.stringify([memberId, amount, method, note]);
    if (keyRef.current?.fingerprint !== fingerprint) keyRef.current = { fingerprint, key: crypto.randomUUID() };
    record.mutate({ amount, method, note, key: keyRef.current.key });
  };

  const reset = () => {
    setInvoiceId(null);
    setDone(null);
    setAmount(500_000);
    setMemberId(undefined);
  };

  return (
    <>
      <PageHeader
        title="Nạp ví tại quầy"
        description="Tiền mặt / thẻ ghi nhận ngay. Chuyển khoản tạo hóa đơn nạp ví kèm mã QR cho khách quét."
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <SectionTitle>Thành viên</SectionTitle>
            <MemberSelect
              value={memberId}
              disabled={Boolean(invoiceId)}
              onChange={(id) => {
                setMemberId(id);
                setDone(null);
              }}
            />
          </Card>
          {memberId && (
            <>
              <WalletCard balance={wallet.data?.balance ?? 0} description="Số dư hiện tại của thành viên" />
              <Card>
                {invoiceId ? (
                  <TransferInvoice invoiceId={invoiceId} onDone={reset} />
                ) : (
                  <Form layout="vertical" requiredMark={false} onFinish={submit}>
                    {done && <Alert type="success" showIcon className="!mb-4" title={done} />}
                    <Form.Item
                      label="Số tiền nạp"
                      validateStatus={error ? 'error' : undefined}
                      help={error ?? `Tối thiểu ${formatVND(minAmount)}`}
                    >
                      <MoneyInput
                        value={amount}
                        step={50_000}
                        size="large"
                        status={error ? 'error' : undefined}
                        onChange={(value) => {
                          setAmount(value);
                          setError(undefined);
                        }}
                      />
                    </Form.Item>
                    <Form.Item label="Hình thức thu">
                      <Radio.Group
                        optionType="button"
                        buttonStyle="solid"
                        value={method}
                        onChange={(event) => setMethod(event.target.value as TopUpMethod)}
                        options={METHODS.map((value) => ({ value, label: PAYMENT_METHOD_LABEL[value] }))}
                      />
                    </Form.Item>
                    {method !== 'TRANSFER' && (
                      <Form.Item label="Ghi chú (không bắt buộc)">
                        <Input value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} />
                      </Form.Item>
                    )}
                    <Button
                      type="primary"
                      size="large"
                      block
                      htmlType="submit"
                      loading={record.isPending || createInvoice.isPending}
                    >
                      {method === 'TRANSFER'
                        ? 'Tạo hóa đơn nạp ví (QR)'
                        : `Xác nhận đã thu ${amount ? formatVND(amount) : ''}`}
                    </Button>
                  </Form>
                )}
              </Card>
            </>
          )}
        </div>
        <Card>
          <SectionTitle>Lịch sử ví</SectionTitle>
          {memberId ? (
            <WalletTransactionsTable
              data={wallet.data?.transactions}
              isLoading={wallet.isFetching}
              error={wallet.error}
              onRetry={() => void wallet.refetch()}
              page={1}
              limit={8}
              onPageChange={() => undefined}
            />
          ) : (
            <Result status="info" title="Chọn thành viên để xem ví" />
          )}
        </Card>
      </div>
    </>
  );
}
