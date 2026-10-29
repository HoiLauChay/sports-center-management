import type { AssistantAction, AttendanceStatus, SupportDraft } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Button, Segmented } from 'antd';
import { Check, ClipboardCheck, FileText, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { useAddToMemberCart } from '~/features/checkout/hooks/useAddToCart';
import { useSaveAttendance } from '~/features/training/hooks/useTraining';
import { ATTENDANCE_ORDER, ATTENDANCE_TAG } from '~/features/training/types';
import { formatVND } from '~/lib/format';

type CartItemAction = Extract<AssistantAction, { type: 'CART_ITEM' }>;
type AttendanceAction = Extract<AssistantAction, { type: 'ATTENDANCE' }>;

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
    return <AttendanceCard key={key} action={action} done={done} onDone={() => onDone(index)} />;
  });
}
