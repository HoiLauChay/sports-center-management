import type { AssistantAction, AttendanceStatus, SupportDraft } from '@sports-center/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { App, Button, Input, Segmented } from 'antd';
import {
  Check,
  ClipboardCheck,
  FileText,
  Landmark,
  School,
  ShoppingCart,
  TicketPercent,
  UserRoundCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useResolveBankTransaction } from '~/features/bank-transactions/hooks/useBankTransactions';
import { useAddToMemberCart } from '~/features/checkout/hooks/useAddToCart';
import { useApproveClass, useAssignCoach, useRejectClass } from '~/features/classes/hooks/useClassAdmin';
import { couponsService } from '~/features/coupons/services/coupons.service';
import { useSaveAttendance } from '~/features/training/hooks/useTraining';
import { ATTENDANCE_ORDER, ATTENDANCE_TAG } from '~/features/training/types';
import { formatDateTime, formatVND } from '~/lib/format';
import { describeApiError } from '~/lib/http-errors';

type CartItemAction = Extract<AssistantAction, { type: 'CART_ITEM' }>;
type AttendanceAction = Extract<AssistantAction, { type: 'ATTENDANCE' }>;
type ClassReviewAction = Extract<AssistantAction, { type: 'CLASS_REVIEW' }>;
type BankMatchAction = Extract<AssistantAction, { type: 'BANK_MATCH' }>;
type AssignCoachAction = Extract<AssistantAction, { type: 'ASSIGN_COACH' }>;
type CouponAction = Extract<AssistantAction, { type: 'CREATE_COUPON' }>;

interface CardProps<A> {
  action: A;
  done: boolean;
  onDone: () => void;
}

const LINK = 'text-[13.5px] font-semibold !text-sc-primary underline underline-offset-2';

function Reasons({ reasons }: { reasons: string[] }) {
  return (
    <ul className="m-0 flex list-disc flex-col gap-0.5 pl-[46px] text-[13px] text-sc-ink-2">
      {reasons.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  );
}

const CARD = 'flex flex-col gap-2.5 rounded-xl border border-sc-primary-border bg-sc-primary-soft px-3.5 py-3';

function Done({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-sc-primary">
      <Check size={15} />
      {children}
    </span>
  );
}

function CardHeader({ icon, label, title }: { icon: React.ReactNode; label: string; title: string }) {
  return (
    <span className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 shrink-0 text-sc-primary">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold tracking-[0.06em] text-sc-primary uppercase">{label}</span>
        <span className="block text-[14px] font-semibold text-sc-ink [overflow-wrap:anywhere]">{title}</span>
      </span>
    </span>
  );
}

/** A service for the member's cart. Paying still happens in the cart, where the price is quoted again. */
function CartItemCard({ action, done, onDone }: { action: CartItemAction; done: boolean; onDone: () => void }) {
  const addToCart = useAddToMemberCart();
  return (
    <div className={CARD}>
      <CardHeader icon={<ShoppingCart size={18} />} label="Thêm vào giỏ" title={action.title} />
      <div className="flex flex-wrap items-center justify-between gap-2 pl-[30px]">
        <span className="text-[13.5px] text-sc-ink-2">
          Tạm tính {action.total < action.subtotal && <s className="text-sc-muted">{formatVND(action.subtotal)}</s>}{' '}
          <b className="text-sc-ink">{action.total === 0 ? 'Miễn phí' : formatVND(action.total)}</b> · thanh toán ở giỏ
          hàng
        </span>
        {done ? (
          <span className="flex items-center gap-3">
            <Done>Đã thêm</Done>
            <Link to="/cart" className="text-[13.5px] font-semibold !text-sc-primary underline underline-offset-2">
              Xem giỏ hàng
            </Link>
          </span>
        ) : (
          <Button
            size="small"
            type="primary"
            icon={<ShoppingCart size={14} />}
            onClick={() => {
              addToCart(action.item);
              onDone();
            }}
          >
            Thêm vào giỏ
          </Button>
        )}
      </div>
    </div>
  );
}

/** The roster as the assistant marked it; the coach can change anyone before saving. */
function AttendanceCard({ action, done, onDone }: { action: AttendanceAction; done: boolean; onDone: () => void }) {
  const [statuses, setStatuses] = useState(() => new Map(action.records.map((r) => [r.accountId, r.status])));
  const save = useSaveAttendance(action.sessionId);
  const counts = ATTENDANCE_ORDER.map(
    (status) =>
      `${[...statuses.values()].filter((value) => value === status).length} ${ATTENDANCE_TAG[status].label.toLowerCase()}`,
  ).join(' · ');

  return (
    <div className={CARD}>
      <CardHeader icon={<ClipboardCheck size={18} />} label="Điểm danh" title={action.title} />
      <ul className="m-0 flex max-h-64 list-none flex-col gap-1.5 overflow-y-auto p-0 pl-[30px]">
        {action.records.map(({ accountId, name }) => (
          <li key={accountId} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[13.5px] text-sc-ink">{name}</span>
            <Segmented<AttendanceStatus>
              size="small"
              disabled={done || save.isPending}
              value={statuses.get(accountId)}
              onChange={(status) => setStatuses((map) => new Map(map).set(accountId, status))}
              options={ATTENDANCE_ORDER.map((status) => ({ value: status, label: ATTENDANCE_TAG[status].label }))}
            />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 pl-[30px]">
        <span className="text-[13px] text-sc-muted">{counts}</span>
        <span className="flex items-center gap-3">
          <Link
            to="/coach/sessions/$sessionId"
            params={{ sessionId: action.sessionId }}
            className="text-[13.5px] font-semibold !text-sc-primary underline underline-offset-2"
          >
            Mở buổi học
          </Link>
          {done ? (
            <Done>Đã lưu</Done>
          ) : (
            <Button
              size="small"
              type="primary"
              loading={save.isPending}
              onClick={() =>
                save.mutate(
                  { records: [...statuses].map(([accountId, status]) => ({ accountId, status })) },
                  { onSuccess: onDone },
                )
              }
            >
              Lưu điểm danh
            </Button>
          )}
        </span>
      </div>
    </div>
  );
}

/** Approve or reject a proposed class; the note goes to the coach and can be edited first. */
function ClassReviewCard({ action, done, onDone }: CardProps<ClassReviewAction>) {
  const [note, setNote] = useState(action.note ?? '');
  const approve = useApproveClass(action.classId);
  const reject = useRejectClass(action.classId);
  const approving = action.decision === 'APPROVE';
  const run = approving ? approve : reject;
  return (
    <div className={CARD}>
      <CardHeader icon={<School size={18} />} label={approving ? 'Duyệt lớp' : 'Từ chối lớp'} title={action.title} />
      <div className="pl-[30px]">
        <Input.TextArea
          size="small"
          autoSize={{ minRows: 1, maxRows: 4 }}
          maxLength={500}
          disabled={done}
          placeholder={approving ? 'Ghi chú cho HLV (không bắt buộc)' : 'Lý do từ chối gửi HLV'}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 pl-[30px]">
        <Link to="/admin/classes/$classId" params={{ classId: action.classId }} className={LINK}>
          Mở lớp
        </Link>
        {done ? (
          <Done>{approving ? 'Đã duyệt' : 'Đã từ chối'}</Done>
        ) : (
          <Button
            size="small"
            type="primary"
            danger={!approving}
            loading={run.isPending}
            disabled={!approving && !note.trim()}
            onClick={() => run.mutate(note.trim() ? { note: note.trim() } : undefined, { onSuccess: onDone })}
          >
            {approving ? 'Duyệt lớp' : 'Từ chối'}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Credit an unmatched transfer to the suggested member; the manager sees why it matched first. */
function BankMatchCard({ action, done, onDone }: CardProps<BankMatchAction>) {
  const resolve = useResolveBankTransaction();
  return (
    <div className={CARD}>
      <CardHeader icon={<Landmark size={18} />} label="Ghi nhận chuyển khoản" title={action.title} />
      <span className="pl-[30px] text-[13.5px] text-sc-ink">
        Cộng {formatVND(action.amount)} vào ví <b>{action.account.fullName}</b>
        {action.account.phone && <span className="text-sc-muted"> · {action.account.phone}</span>}
      </span>
      <Reasons reasons={action.reasons} />
      <div className="flex flex-wrap items-center justify-end gap-3 pl-[30px]">
        <Link to="/admin/bank-transactions" className={LINK}>
          Mở giao dịch
        </Link>
        {done ? (
          <Done>Đã ghi nhận</Done>
        ) : (
          <Button
            size="small"
            type="primary"
            loading={resolve.isPending}
            onClick={() =>
              resolve.mutate(
                { id: action.transactionId, body: { accountId: action.account.id, note: action.note } },
                { onSuccess: onDone },
              )
            }
          >
            Ghi nhận vào ví
          </Button>
        )}
      </div>
    </div>
  );
}

function AssignCoachCard({ action, done, onDone }: CardProps<AssignCoachAction>) {
  const assign = useAssignCoach(action.classId);
  return (
    <div className={CARD}>
      <CardHeader icon={<UserRoundCheck size={18} />} label="Phân công HLV" title={action.title} />
      <span className="pl-[30px] text-[13.5px] text-sc-ink">
        HLV <b>{action.coach.fullName}</b>
      </span>
      <Reasons reasons={action.reasons} />
      <div className="flex flex-wrap items-center justify-end gap-3 pl-[30px]">
        <Link to="/admin/classes/$classId" params={{ classId: action.classId }} className={LINK}>
          Mở lớp
        </Link>
        {done ? (
          <Done>Đã phân công</Done>
        ) : (
          <Button
            size="small"
            type="primary"
            loading={assign.isPending}
            onClick={() =>
              assign.mutate(
                action.registrationId ? { registrationId: action.registrationId } : { coachId: action.coach.id },
                { onSuccess: onDone },
              )
            }
          >
            Phân công
          </Button>
        )}
      </div>
    </div>
  );
}

function CouponCard({ action, done, onDone }: CardProps<CouponAction>) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { coupon } = action;
  const create = useMutation({
    mutationFn: () =>
      couponsService.create({
        maxDiscount: null,
        minOrderAmount: null,
        maxUses: null,
        maxUsesPerUser: 1,
        applicableTypes: null,
        isActive: true,
        ...coupon,
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['coupons'] });
      message.success(`Đã tạo mã ${created.code}`);
      onDone();
    },
    onError: (error) => message.error(describeApiError(error)),
  });
  return (
    <div className={CARD}>
      <CardHeader icon={<TicketPercent size={18} />} label="Tạo mã giảm giá" title={action.title} />
      <span className="pl-[30px] text-[13.5px] text-sc-ink-2">
        {coupon.name} · hiệu lực {formatDateTime(coupon.validFrom)} – {formatDateTime(coupon.validTo)}
      </span>
      <Reasons reasons={[action.reason]} />
      <div className="flex flex-wrap items-center justify-end gap-3 pl-[30px]">
        <Link to="/admin/coupons" className={LINK}>
          Mã giảm giá
        </Link>
        {done ? (
          <Done>Đã tạo</Done>
        ) : (
          <Button size="small" type="primary" loading={create.isPending} onClick={() => create.mutate()}>
            Tạo mã
          </Button>
        )}
      </div>
    </div>
  );
}

function SupportCard({ draft, onOpen }: { draft: SupportDraft; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex cursor-pointer items-center gap-3 self-start rounded-xl border border-sc-primary-border bg-sc-primary-soft px-3.5 py-2.5 text-left"
    >
      <FileText size={18} className="shrink-0 text-sc-primary" />
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-sc-primary">Xem và gửi yêu cầu</span>
        <span className="block text-[13.5px] text-sc-ink-2 [overflow-wrap:anywhere]">{draft.subject}</span>
      </span>
    </button>
  );
}

interface ActionCardsProps {
  actions: AssistantAction[];
  doneActions: number[];
  onOpenDraft: (draft: SupportDraft) => void;
  onDone: (index: number) => void;
}

/**
 * What the assistant prepared under its answer. Nothing has happened yet: each card does what the page would do
 * without the assistant (add to the cart, save attendance, open the support form) only when the person confirms.
 */
export function ActionCards({ actions, doneActions, onOpenDraft, onDone }: ActionCardsProps) {
  return actions.map((action, index) => {
    const done = doneActions.includes(index);
    const key = `${action.type}-${index}`;
    if (action.type === 'SUPPORT_REQUEST') {
      return <SupportCard key={key} draft={action.draft} onOpen={() => onOpenDraft(action.draft)} />;
    }
    if (action.type === 'CART_ITEM') {
      return <CartItemCard key={key} action={action} done={done} onDone={() => onDone(index)} />;
    }
    const props = { done, onDone: () => onDone(index) };
    switch (action.type) {
      case 'ATTENDANCE':
        return <AttendanceCard key={key} action={action} {...props} />;
      case 'CLASS_REVIEW':
        return <ClassReviewCard key={key} action={action} {...props} />;
      case 'BANK_MATCH':
        return <BankMatchCard key={key} action={action} {...props} />;
      case 'ASSIGN_COACH':
        return <AssignCoachCard key={key} action={action} {...props} />;
      case 'CREATE_COUPON':
        return <CouponCard key={key} action={action} {...props} />;
    }
  });
}
