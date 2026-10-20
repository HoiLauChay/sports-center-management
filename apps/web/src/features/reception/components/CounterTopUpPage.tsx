import type { AccountSummary } from '@sports-center/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Alert, App, Avatar, Button, Card, Form, Input, Modal, Radio, Tag } from 'antd';
import { Banknote, CreditCard, Info, Mail, Phone, QrCode, User } from 'lucide-react';
import { useRef, useState } from 'react';
import { EmptyState } from '~/components/feedback/States';
import { MemberSelect } from '~/components/form/MemberSelect';
import { MoneyInput } from '~/components/form/MoneyInput';
import { PageHeader } from '~/components/ui/PageHeader';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { WalletCard } from '~/components/ui/WalletCard';
import { PAYMENT_METHOD_LABEL } from '~/constants/payment';
import { useSettings } from '~/features/settings';
import { usersService } from '~/features/users/services/users.service';
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

const PRESET_AMOUNTS = [100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

function TransferInvoiceModal({
  invoiceId,
  onDone,
  onCancel,
}: {
  invoiceId: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { message } = App.useApp();
  const invoice = useInvoice(invoiceId ?? '');
  useRefreshAfterPaid(invoice.data, (paid) => {
    message.success(`Đã nhận ${formatVND(paid.amount)}, ví thành viên đã được cộng.`);
    onDone();
  });

  return (
    <Modal
      open={Boolean(invoiceId)}
      onCancel={onCancel}
      footer={null}
      width={720}
      destroyOnClose
      centered
      title={
        <div className="flex items-center gap-2">
          <QrCode className="size-5 text-purple-600" />
          <span className="font-display font-bold text-base">Quét mã QR chuyển khoản nạp ví</span>
        </div>
      }
    >
      <div className="py-2">
        {!invoice.data ? (
          <p className="m-0 text-sc-muted py-8 text-center">Đang tải thông tin hóa đơn…</p>
        ) : (
          <>
            <InvoicePayPanel
              invoice={invoice.data}
              paidMessage={`Đã nhận ${formatVND(invoice.data.amount)}. Ví thành viên đã được cộng.`}
              paidActions={
                <Button type="primary" size="large" onClick={onDone}>
                  Hoàn tất
                </Button>
              }
            />
            {invoice.data.status !== 'PENDING' && invoice.data.status !== 'PAID' && (
              <div className="mt-4 text-center">
                <Button onClick={onCancel}>Đóng và quay lại</Button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

interface MemberInfo {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  status?: string;
}

/** `/reception/top-up`: cash / card top-ups are recorded at once; transfer creates a top-up invoice with a QR. */
export function CounterTopUpPage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const settings = useSettings();
  const minAmount = settings.data?.topUpMinAmount ?? 10_000;
  const [memberId, setMemberId] = useState<string | undefined>(search.memberId);
  const [selectedMember, setSelectedMember] = useState<AccountSummary | undefined>();
  const [amount, setAmount] = useState<number | null>(500_000);
  const [method, setMethod] = useState<TopUpMethod>('CASH');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const keyRef = useRef<{ fingerprint: string; key: string } | null>(null);

  const memberDetail = useQuery({
    queryKey: ['users', 'detail', memberId],
    queryFn: () => usersService.get(memberId!),
    enabled: Boolean(memberId) && !selectedMember,
    staleTime: 60_000,
  });

  const memberInfo: MemberInfo | undefined =
    selectedMember ??
    (memberDetail.data
      ? {
          id: memberDetail.data.id,
          fullName: memberDetail.data.fullName,
          email: memberDetail.data.email,
          phone: memberDetail.data.phone,
          avatarUrl: memberDetail.data.avatarUrl,
          status: memberDetail.data.status,
        }
      : undefined);

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
        `Đã nạp thành công ${formatVND(transaction.amount)} (${PAYMENT_METHOD_LABEL[transaction.method ?? 'CASH']}) vào ví.`,
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

  const handleSelectMember = (id: string | undefined, member: AccountSummary | undefined) => {
    setMemberId(id);
    setSelectedMember(member);
    setDone(null);
    void navigate({ search: { memberId: id }, replace: true });
  };

  const handleClearMember = () => {
    handleSelectMember(undefined, undefined);
  };

  const handleTransferDone = () => {
    refreshWallet();
    setInvoiceId(null);
    setDone('Nạp tiền qua chuyển khoản QR thành công. Số dư ví thành viên đã được cập nhật.');
  };

  return (
    <>
      <PageHeader title="Nạp ví tại quầy" />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {/* 1. Chọn & thông tin thành viên */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="[&>h3]:!mb-0">
                <SectionTitle>1. Thành viên</SectionTitle>
              </div>
              {memberInfo && (
                <Button
                  size="small"
                  type="text"
                  disabled={Boolean(invoiceId)}
                  onClick={handleClearMember}
                  className="!text-[13.5px] text-sc-muted hover:!text-sc-error"
                >
                  Đổi khách
                </Button>
              )}
            </div>

            {memberInfo ? (
              <div className="flex items-center gap-3 rounded-xl border border-sc-border bg-sc-paper p-3.5">
                <Avatar
                  size={46}
                  src={memberInfo.avatarUrl}
                  className="shrink-0 bg-sc-ink text-sc-lime font-bold text-base border border-sc-border"
                >
                  {memberInfo.fullName ? memberInfo.fullName.charAt(0).toUpperCase() : <User className="size-5" />}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sc-ink truncate text-[15px]">{memberInfo.fullName}</span>
                    <Tag color="green" className="!m-0 text-[12.5px] px-1.5 py-0 leading-tight">
                      Active
                    </Tag>
                  </div>
                  <div className="flex flex-col gap-0.5 text-[13.5px] text-sc-muted mt-1">
                    {memberInfo.phone && (
                      <span className="flex items-center gap-1.5 font-mono">
                        <Phone className="size-3 text-sc-muted" />
                        {memberInfo.phone}
                      </span>
                    )}
                    {memberInfo.email && (
                      <span className="flex items-center gap-1.5 truncate">
                        <Mail className="size-3 text-sc-muted" />
                        {memberInfo.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <MemberSelect
                  value={memberId}
                  disabled={Boolean(invoiceId)}
                  onChange={handleSelectMember}
                  className="w-full"
                  placeholder="Nhập tên, SĐT hoặc email để tìm…"
                />
              </div>
            )}
          </Card>

          {/* 2. Thẻ số dư ví (chỉ hiển thị khi đã chọn thành viên) */}
          {memberId && (
            <WalletCard
              balance={wallet.data?.balance ?? 0}
              description={wallet.isFetching ? 'Đang cập nhật số dư…' : 'Số dư khả dụng hiện tại của thành viên'}
            />
          )}

          {/* 3. Form nạp tiền */}
          <Card>
            <SectionTitle>2. Thông tin nạp ví</SectionTitle>
            <Form layout="vertical" requiredMark={false} onFinish={submit}>
              {done && <Alert type="success" showIcon className="!mb-4" title={done} />}

              {!memberId && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5 text-[13.5px] text-amber-800 dark:text-amber-200">
                  <Info className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Chọn thành viên ở trên trước khi thực hiện giao dịch nạp ví.</span>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-[13.5px] font-semibold text-sc-ink uppercase tracking-wider mb-2">
                  Mệnh giá nạp
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_AMOUNTS.map((val) => {
                    const isSelected = amount === val;
                    return (
                      <Button
                        key={val}
                        type={isSelected ? 'primary' : 'default'}
                        disabled={!memberId}
                        onClick={() => {
                          setAmount(val);
                          setError(undefined);
                        }}
                        className="!h-10 font-semibold tabular-nums"
                      >
                        {formatVND(val)}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <Form.Item
                label={<span className="font-semibold text-sc-ink">Hoặc nhập số tiền khác</span>}
                validateStatus={error ? 'error' : undefined}
                help={error ?? `Tối thiểu ${formatVND(minAmount)}`}
                className="!mb-4"
              >
                <MoneyInput
                  value={amount}
                  step={50_000}
                  size="large"
                  status={error ? 'error' : undefined}
                  disabled={!memberId}
                  onChange={(value) => {
                    setAmount(value);
                    setError(undefined);
                  }}
                />
              </Form.Item>

              <Form.Item
                label={<span className="font-semibold text-sc-ink">Hình thức thu tiền</span>}
                className="!mb-4"
              >
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  value={method}
                  disabled={!memberId}
                  onChange={(event) => setMethod(event.target.value as TopUpMethod)}
                  className="w-full flex"
                >
                  <Radio.Button value="CASH" className="flex-1 text-center">
                    <Banknote className="inline size-4 mr-1 text-emerald-600 align-sub" /> Tiền mặt
                  </Radio.Button>
                  <Radio.Button value="CARD" className="flex-1 text-center">
                    <CreditCard className="inline size-4 mr-1 text-blue-600 align-sub" /> Quẹt thẻ
                  </Radio.Button>
                  <Radio.Button value="TRANSFER" className="flex-1 text-center">
                    <QrCode className="inline size-4 mr-1 text-purple-600 align-sub" /> QR Code
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>

              {method !== 'TRANSFER' && (
                <Form.Item label="Ghi chú (không bắt buộc)" className="!mb-4">
                  <Input
                    value={note}
                    maxLength={200}
                    disabled={!memberId}
                    placeholder="Ghi chú thu tiền mặt / quẹt thẻ…"
                    onChange={(event) => setNote(event.target.value)}
                  />
                </Form.Item>
              )}

              <Button
                type="primary"
                size="large"
                block
                htmlType="submit"
                disabled={!memberId}
                loading={record.isPending || createInvoice.isPending}
                className="!h-11 !text-[15px] font-bold shadow-sm"
              >
                {!memberId
                  ? 'Chọn thành viên để nạp ví'
                  : method === 'TRANSFER'
                    ? `Tạo hóa đơn nạp ví (QR) ${amount ? `· ${formatVND(amount)}` : ''}`
                    : `Xác nhận đã thu ${amount ? formatVND(amount) : ''}`}
              </Button>
            </Form>
          </Card>
        </div>

        {/* Cột phải: Lịch sử ví */}
        <Card className="h-full">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-sc-border">
            <div className="[&>h3]:!mb-0">
              <SectionTitle>Lịch sử giao dịch ví</SectionTitle>
            </div>
            {memberInfo && (
              <Tag color="cyan" className="!m-0 text-[13.5px] font-semibold">
                {memberInfo.fullName}
              </Tag>
            )}
          </div>

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
            <div className="flex flex-1 items-center justify-center py-20">
              <EmptyState
                title="Chưa chọn thành viên"
                description="Chọn thành viên ở cột bên trái để xem số dư và lịch sử giao dịch ví."
              />
            </div>
          )}
        </Card>
      </div>

      {/* Modal hiển thị mã QR chuyển khoản */}
      <TransferInvoiceModal invoiceId={invoiceId} onDone={handleTransferDone} onCancel={() => setInvoiceId(null)} />
    </>
  );
}
