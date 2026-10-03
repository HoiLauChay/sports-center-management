import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Alert, App, Button, Card, Form } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { MoneyInput } from '~/components/form/MoneyInput';
import { MappedTag } from '~/components/ui/MappedTag';
import { PageHeader } from '~/components/ui/PageHeader';
import { INVOICE_STATUS_TAG, invoiceStatusOf } from '~/constants/payment';
import { useSettings } from '~/features/settings';
import { formatDateTime, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { walletService } from '../services/wallet.service';

const QUICK_AMOUNTS = [100_000, 200_000, 500_000, 1_000_000, 2_000_000];

export function TopUpPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const settings = useSettings();
  const minAmount = settings.data?.topUpMinAmount ?? 10_000;
  const [amount, setAmount] = useState<number | null>(500_000);
  const [error, setError] = useState<string>();

  const pending = useQuery({
    queryKey: ['invoices', 'mine', 'pending'],
    queryFn: () => walletService.listInvoices({ page: 1, limit: 5, purpose: 'WALLET_TOP_UP', status: 'PENDING' }),
  });
  const waiting = pending.data?.items.filter((invoice) => invoiceStatusOf(invoice) === 'PENDING') ?? [];

  const create = useMutation({
    mutationFn: (value: number) => walletService.createTopUp({ amount: value }),
    onSuccess: (invoice) => void navigate({ to: '/invoices/$invoiceId', params: { invoiceId: invoice.id } }),
    onError: (err) => {
      const apiError = toApiError(err);
      setError(apiError.errors?.[0]?.message ?? apiError.message);
      message.error(apiError.message);
    },
  });

  const submit = () => {
    if (create.isPending) return;
    if (amount === null || !Number.isFinite(amount)) return setError('Vui lòng nhập số tiền');
    if (amount < minAmount) return setError(`Số tiền nạp tối thiểu là ${formatVND(minAmount)}`);
    setError(undefined);
    create.mutate(amount);
  };

  return (
    <>
      <PageHeader
        title="Nạp tiền vào ví"
        description="Nhập số tiền, hệ thống tạo hóa đơn kèm mã QR chuyển khoản. Tiền về ví trong vài giây sau khi chuyển."
        extra={
          <Link to="/wallet">
            <Button icon={<ArrowLeft size={16} />}>Về ví</Button>
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <Form layout="vertical" requiredMark={false} onFinish={submit}>
            <div className="mb-4 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.filter((value) => value >= minAmount).map((value) => (
                <Button
                  key={value}
                  type={amount === value ? 'primary' : 'default'}
                  onClick={() => {
                    setAmount(value);
                    setError(undefined);
                  }}
                >
                  {formatVND(value)}
                </Button>
              ))}
            </div>
            <Form.Item
              label="Số tiền nạp"
              validateStatus={error ? 'error' : undefined}
              help={error ?? `Tối thiểu ${formatVND(minAmount)}`}
            >
              <MoneyInput
                value={amount}
                onChange={(value) => {
                  setAmount(value);
                  setError(undefined);
                }}
                min={0}
                step={50_000}
                status={error ? 'error' : undefined}
                size="large"
              />
            </Form.Item>
            <Button type="primary" size="large" htmlType="submit" loading={create.isPending} block>
              Tạo hóa đơn nạp {amount ? formatVND(amount) : ''}
            </Button>
            <p className="mt-3 mb-0 text-xs text-sc-muted-2">
              Mỗi thành viên chỉ có tối đa 3 hóa đơn đang chờ thanh toán. Hóa đơn hết hạn sau{' '}
              {settings.data?.invoiceExpiryMinutes ?? 15} phút; chuyển khoản trễ vẫn được cộng nếu đúng nội dung và số
              tiền.
            </p>
          </Form>
        </Card>
        <Card title="Hóa đơn đang chờ" size="small">
          {waiting.length ? (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {waiting.map((invoice) => (
                <li key={invoice.id}>
                  <Link
                    to="/invoices/$invoiceId"
                    params={{ invoiceId: invoice.id }}
                    className="flex items-center justify-between gap-2 rounded-lg border border-sc-border-soft px-3 py-2 !text-sc-ink no-underline hover:bg-sc-paper"
                  >
                    <span className="flex flex-col">
                      <b className="tabular-nums">{formatVND(invoice.amount)}</b>
                      <span className="text-xs text-sc-muted">{formatDateTime(invoice.createdAt)}</span>
                    </span>
                    <MappedTag value={invoice.status} map={INVOICE_STATUS_TAG} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Alert type="info" showIcon title="Không có hóa đơn nào đang chờ." />
          )}
        </Card>
      </div>
    </>
  );
}
