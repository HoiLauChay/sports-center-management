import type { BankTransaction } from '@sports-center/shared';
import { Form, Input, Modal } from 'antd';
import { useState } from 'react';
import { MemberSelect } from '~/components/form/MemberSelect';
import { BankMatchSuggestions } from '~/features/manager-ai/components/BankMatchSuggestions';
import { formatDateTime, formatVND } from '~/lib/format';
import { useIgnoreBankTransaction, useResolveBankTransaction } from '../hooks/useBankTransactions';
import { TransferIssue, TransferPayer } from './TransferOrigin';

function Summary({ transaction }: { transaction: BankTransaction }) {
  return (
    <div className="mb-4 rounded-lg bg-sc-paper px-4 py-3 text-[14.5px]">
      <div className="flex justify-between gap-3">
        <b className="text-[16px] tabular-nums">{formatVND(transaction.amount)}</b>
        <span className="text-sc-muted">{formatDateTime(transaction.transactionDate)}</span>
      </div>
      <div className="mt-1 [overflow-wrap:anywhere]">{transaction.content}</div>
      <div className="text-sc-muted-2">Mã tham chiếu: {transaction.referenceCode ?? '—'}</div>
      {transaction.issue && (
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3 border-t border-sc-border pt-3">
          <TransferPayer transaction={transaction} />
          <TransferIssue transaction={transaction} />
        </div>
      )}
    </div>
  );
}

const draftNote = (transaction: BankTransaction | null) => {
  if (!transaction?.codeInvoice?.account) return '';
  const code = transaction.paymentCode;
  if (transaction.issue === 'ALREADY_PAID') return `Khách chuyển trùng hóa đơn ${code}, cộng lại vào ví`;
  if (transaction.issue === 'AMOUNT_MISMATCH') return `Chuyển khác số tiền hóa đơn ${code}, cộng vào ví`;
  return `Tiền về sau khi hóa đơn ${code} đã đóng, cộng vào ví`;
};

interface ModalProps {
  transaction: BankTransaction | null;
  onClose: () => void;
}

/** Assign an unmatched transaction to a member: the exact amount is credited to their wallet. */
export function ResolveModal({ transaction, onClose }: ModalProps) {
  const resolve = useResolveBankTransaction();
  // The payment code tells who meant to pay: start from that member and a drafted note; the manager can change both.
  // The page remounts this modal per transaction (`key`), so these defaults follow the row being handled.
  const [accountId, setAccountId] = useState(transaction?.codeInvoice?.account?.id);
  const [note, setNote] = useState(() => draftNote(transaction));
  const [touched, setTouched] = useState(false);
  const [picked, setPicked] = useState<{ id: string; fullName: string; phone: string | null; email?: string }[]>([]);

  const guest = Boolean(transaction?.codeInvoice && !transaction.codeInvoice.account);

  const noteError = touched && !note.trim() ? 'Vui lòng nhập ghi chú đối soát' : undefined;
  const memberError = touched && !accountId ? 'Vui lòng chọn thành viên' : undefined;

  const close = () => {
    setAccountId(undefined);
    setNote('');
    setTouched(false);
    onClose();
  };

  const submit = () => {
    setTouched(true);
    if (!transaction || !accountId || !note.trim() || resolve.isPending) return;
    resolve.mutate({ id: transaction.id, body: { accountId, note: note.trim() } }, { onSuccess: close });
  };

  return (
    <Modal
      open={Boolean(transaction)}
      title="Gán giao dịch cho thành viên"
      okText="Gán và cộng ví"
      cancelText="Hủy"
      mask={{ closable: false }}
      confirmLoading={resolve.isPending}
      onOk={submit}
      onCancel={() => !resolve.isPending && close()}
      destroyOnHidden
    >
      {transaction && <Summary transaction={transaction} />}
      {guest && (
        <p className="m-0 mb-4 rounded-lg bg-sc-accent-soft px-3 py-2 text-[14.5px] text-sc-ink-2">
          Người chuyển là khách vãng lai, không có ví. Liên hệ khách theo số điện thoại để hoàn tiền, rồi bấm Bỏ qua và
          ghi lại cách đã xử lý.
        </p>
      )}
      {transaction && !guest && (
        <BankMatchSuggestions
          transactionId={transaction.id}
          selectedId={accountId}
          onPick={({ account, reasons }) => {
            setPicked([
              { id: account.id, fullName: account.fullName, phone: account.phone, email: account.email ?? undefined },
            ]);
            setAccountId(account.id);
            if (!note.trim()) setNote(`Khớp theo gợi ý: ${reasons.join('; ')}`.slice(0, 500));
          }}
        />
      )}
      <Form layout="vertical" requiredMark={false}>
        <Form.Item label="Thành viên nhận tiền" validateStatus={memberError ? 'error' : undefined} help={memberError}>
          <MemberSelect
            value={accountId}
            initial={[...(transaction?.codeInvoice?.account ? [transaction.codeInvoice.account] : []), ...picked]}
            status={memberError ? 'error' : undefined}
            onChange={setAccountId}
          />
        </Form.Item>
        <Form.Item
          label="Ghi chú đối soát"
          validateStatus={noteError ? 'error' : undefined}
          help={noteError ?? 'Nội dung được lưu vào nhật ký thao tác.'}
        >
          <Input.TextArea
            value={note}
            maxLength={500}
            showCount
            className="!mb-5"
            autoSize={{ minRows: 3, maxRows: 6 }}
            status={noteError ? 'error' : undefined}
            onChange={(event) => setNote(event.target.value)}
          />
        </Form.Item>
      </Form>
      <p className="m-0 text-[13.5px] text-sc-muted-2">
        Hệ thống cộng đúng số tiền của giao dịch vào ví thành viên, ghi nhật ký và gửi thông báo cho họ. Mỗi giao dịch
        chỉ được cộng một lần.
      </p>
    </Modal>
  );
}

/** Dismiss an unmatched transaction (e.g. not ours / duplicate) with a mandatory note. */
export function IgnoreModal({ transaction, onClose }: ModalProps) {
  const ignore = useIgnoreBankTransaction();
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const noteError = touched && !note.trim() ? 'Vui lòng nhập lý do bỏ qua' : undefined;

  const close = () => {
    setNote('');
    setTouched(false);
    onClose();
  };

  const submit = () => {
    setTouched(true);
    if (!transaction || !note.trim() || ignore.isPending) return;
    ignore.mutate({ id: transaction.id, body: { note: note.trim() } }, { onSuccess: close });
  };

  return (
    <Modal
      open={Boolean(transaction)}
      title="Bỏ qua giao dịch"
      okText="Bỏ qua giao dịch"
      okButtonProps={{ danger: true }}
      cancelText="Hủy"
      mask={{ closable: false }}
      confirmLoading={ignore.isPending}
      onOk={submit}
      onCancel={() => !ignore.isPending && close()}
      destroyOnHidden
    >
      {transaction && <Summary transaction={transaction} />}
      <Form layout="vertical" requiredMark={false}>
        <Form.Item
          label="Lý do bỏ qua"
          validateStatus={noteError ? 'error' : undefined}
          help={noteError ?? 'Giao dịch bị bỏ qua không cộng tiền cho ai và không thể hoàn tác.'}
        >
          <Input.TextArea
            value={note}
            maxLength={500}
            showCount
            className="!mb-5"
            autoSize={{ minRows: 3, maxRows: 6 }}
            status={noteError ? 'error' : undefined}
            onChange={(event) => setNote(event.target.value)}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
