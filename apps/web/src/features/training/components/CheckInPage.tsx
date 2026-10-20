import { ERROR_CODE, type Booking, type CheckIn, type Person } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { App, Button, Segmented, Skeleton, Tag } from 'antd';
import { CalendarClock, CheckCircle2, LogIn, ScanLine, TriangleAlert, UserSearch, Wallet, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { EmptyState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { useBookingsOn } from '~/features/bookings/hooks/useBookings';
import type { DraftBuyer } from '~/features/checkout/store/cartStore';
import { CounterCustomerSearch, CustomerAvatar } from '~/features/reception/components/CounterCustomerSearch';
import '~/features/reception/counter.css';
import { useCounterHotkeys } from '~/features/reception/hooks/useCounterHotkeys';
import { CUSTOMER_SEARCH_ID } from '~/features/reception/utils';
import { formatDateTime } from '~/lib/format';
import { describeApiError, toApiError } from '~/lib/http-errors';
import { nowVN, todayVN } from '~/lib/time';
import { useCheckIn, useCheckInsToday } from '../hooks/useTraining';

type Member = Extract<DraftBuyer, { kind: 'MEMBER' }>;

const timeOf = (iso: string) => formatDateTime(iso).slice(0, 5);
const minutesOf = (hhmm: string) => {
  const [hours = 0, minutes = 0] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
};
const focusSearch = () => window.setTimeout(() => document.getElementById(CUSTOMER_SEARCH_ID)?.focus(), 0);

/** Current time (`HH:mm`, Vietnam) refreshed every 30 seconds, so "đang diễn ra / sau 10 phút" stay true. */
function useClock() {
  const [now, setNow] = useState(() => nowVN().format('HH:mm'));
  useEffect(() => {
    const timer = window.setInterval(() => setNow(nowVN().format('HH:mm')), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

type SlotState = 'ongoing' | 'soon' | 'later' | 'past';

function slotState(slot: Pick<Booking, 'startTime' | 'endTime'>, now: string): { state: SlotState; label: string } {
  const current = minutesOf(now);
  const start = minutesOf(slot.startTime);
  const end = minutesOf(slot.endTime);
  if (current >= end) return { state: 'past', label: 'Đã hết giờ' };
  if (current >= start) return { state: 'ongoing', label: 'Đang diễn ra' };
  if (start - current <= 60) return { state: 'soon', label: `Sau ${start - current} phút` };
  return { state: 'later', label: `Lúc ${slot.startTime}` };
}

const SLOT_TONE: Record<SlotState, string> = {
  ongoing: 'border-sc-success/30 bg-sc-success/10 text-sc-success',
  soon: 'border-sc-warning/30 bg-sc-warning/10 text-sc-warning',
  later: 'border-sc-border bg-sc-paper text-sc-ink-2',
  past: 'border-sc-border-soft bg-white text-sc-muted-2 line-through',
};

interface Arrival {
  account: Person;
  slots: Booking[];
  checkIn?: CheckIn;
  /** Sort key: start of the next slot that has not ended, or end of day + last start for finished ones. */
  order: number;
}

function SlotChip({ slot, now }: { slot: Booking; now: string }) {
  const { state } = slotState(slot, now);
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[13.5px] font-medium tabular-nums ${SLOT_TONE[state]}`}>
      {slot.facility.name} · {slot.startTime}–{slot.endTime}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-sc-border bg-white px-4 py-2.5 shadow-xs">
      <span className="text-[12.5px] font-semibold tracking-[0.06em] text-sc-muted uppercase">{label}</span>
      <span className={`font-display text-[26px] leading-tight font-extrabold tabular-nums ${tone ?? 'text-sc-ink'}`}>
        {value}
      </span>
    </div>
  );
}

/** The chosen member: why they may (or may not) come in today, and the one big confirm button. */
function MemberPanel({
  member,
  slots,
  checkIn,
  now,
  refusal,
  pending,
  onConfirm,
  onClear,
}: {
  member: Member;
  slots: Booking[];
  checkIn?: CheckIn;
  now: string;
  refusal: string | null;
  pending: boolean;
  onConfirm: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <CustomerAvatar name={member.fullName} />
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <b className="truncate text-[17px] text-sc-ink">{member.fullName}</b>
          {member.phone && <span className="text-[14.5px] text-sc-muted tabular-nums">{member.phone}</span>}
        </div>
        <Button icon={<X size={15} />} onClick={onClear}>
          Đổi người
        </Button>
      </div>

      <div className="rounded-xl border border-sc-border-soft bg-sc-paper/60 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[13.5px] font-semibold tracking-[0.06em] text-sc-muted uppercase">
          <CalendarClock size={14} />
          Lịch hôm nay
        </div>
        {slots.length ? (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {slots.map((slot) => {
              const { state, label } = slotState(slot, now);
              return (
                <li
                  key={slot.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-[15px]"
                >
                  <span className="font-semibold text-sc-ink">{slot.facility.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums text-sc-ink-2">
                      {slot.startTime}–{slot.endTime}
                    </span>
                    <span className={`rounded-md border px-1.5 py-0.5 text-[13px] font-semibold ${SLOT_TONE[state]}`}>
                      {label}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="m-0 flex items-start gap-2 text-[14.5px] text-sc-ink-2">
            <TriangleAlert size={16} className="mt-px shrink-0 text-sc-warning" />
            Không có lượt đặt sân hôm nay. Chỉ check-in được nếu hội viên có buổi học của lớp đang theo học hôm nay.
          </p>
        )}
      </div>

      {checkIn && (
        <p className="m-0 flex items-center gap-2 rounded-lg bg-sc-primary-soft px-3 py-2 text-[14.5px] text-sc-primary">
          <CheckCircle2 size={16} className="shrink-0" />
          Đã check-in lúc <b>{timeOf(checkIn.checkedInAt)}</b>. Có thể check-in thêm lượt nếu khách vào ca sau.
        </p>
      )}

      {refusal && (
        <p className="m-0 flex items-start gap-2 rounded-lg border border-sc-error/30 bg-sc-error/5 px-3 py-2.5 text-[14.5px] text-sc-error">
          <TriangleAlert size={16} className="mt-px shrink-0" />
          <span>
            <b>Chưa check-in được.</b> {refusal}
          </span>
        </p>
      )}

      <Button
        type="primary"
        size="large"
        block
        autoFocus
        loading={pending}
        icon={<LogIn size={18} />}
        onClick={onConfirm}
        className="!h-14 !text-[17px] !font-bold"
      >
        <span className="flex w-full items-center justify-between gap-3">
          <span>{checkIn ? 'Check-in thêm lượt' : 'Xác nhận check-in'}</span>
          <kbd className="counter-kbd counter-kbd-on-primary">Enter</kbd>
        </span>
      </Button>

      <div className="flex flex-wrap gap-2 text-[14.5px]">
        <Link to="/reception/order" search={{ memberId: member.accountId }}>
          <Button size="small">Bán dịch vụ</Button>
        </Link>
        <Link to="/reception/top-up" search={{ memberId: member.accountId }}>
          <Button size="small" icon={<Wallet size={13} />}>
            Nạp ví
          </Button>
        </Link>
      </div>
    </div>
  );
}

function ArrivalRow({
  arrival,
  now,
  pending,
  onCheckIn,
  onOpen,
}: {
  arrival: Arrival;
  now: string;
  pending: boolean;
  onCheckIn: () => void;
  onOpen: () => void;
}) {
  const next = arrival.slots.find((slot) => slotState(slot, now).state !== 'past') ?? arrival.slots.at(-1)!;
  const { state, label } = slotState(next, now);
  return (
    <li className="flex items-center gap-3 rounded-xl border border-sc-border-soft bg-white px-3 py-2.5">
      <span
        className={`flex w-14 shrink-0 flex-col items-center rounded-lg border py-1 leading-tight ${SLOT_TONE[state].replace(' line-through', '')}`}
      >
        <b className="font-display text-[17px] tabular-nums">{next.startTime}</b>
        <span className="text-[12px] font-semibold whitespace-nowrap">
          {state === 'ongoing'
            ? 'Đang chơi'
            : state === 'soon'
              ? label.replace('Sau ', '')
              : state === 'past'
                ? 'Hết giờ'
                : ''}
        </span>
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-1 border-0 bg-transparent p-0 text-left"
      >
        <b className="truncate text-[14.5px] text-sc-ink hover:text-sc-primary">{arrival.account.fullName}</b>
        <span className="flex flex-wrap gap-1">
          {arrival.slots.map((slot) => (
            <SlotChip key={slot.id} slot={slot} now={now} />
          ))}
        </span>
      </button>
      {arrival.checkIn ? (
        <Tag color="green" className="!m-0 shrink-0 tabular-nums">
          Đã vào {timeOf(arrival.checkIn.checkedInAt)}
        </Tag>
      ) : (
        <Button type="primary" loading={pending} icon={<LogIn size={15} />} onClick={onCheckIn} className="shrink-0">
          Check-in
        </Button>
      )}
    </li>
  );
}

/** `/reception/checkin`: find a member (or pick from today's bookings) and confirm their entry in one tap. */
export function CheckInPage() {
  const { message } = App.useApp();
  const now = useClock();
  const [member, setMember] = useState<Member | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [flash, setFlash] = useState<CheckIn | null>(null);
  const [filter, setFilter] = useState<'waiting' | 'in'>('waiting');

  const checkIn = useCheckIn();
  const today = useCheckInsToday();
  const bookings = useBookingsOn(todayVN());

  const latestCheckIn = useMemo(() => {
    const map = new Map<string, CheckIn>();
    for (const entry of today.data ?? []) {
      const known = map.get(entry.account.id);
      if (!known || entry.checkedInAt > known.checkedInAt) map.set(entry.account.id, entry);
    }
    return map;
  }, [today.data]);

  const arrivals = useMemo(() => {
    const map = new Map<string, Arrival>();
    for (const booking of bookings.data ?? []) {
      if (!booking.account) continue;
      const entry = map.get(booking.account.id) ?? { account: booking.account, slots: [], order: 0 };
      entry.slots.push(booking);
      map.set(booking.account.id, entry);
    }
    const current = minutesOf(now);
    return [...map.values()]
      .map((entry) => {
        const slots = [...entry.slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
        const next = slots.find((slot) => minutesOf(slot.endTime) > current);
        return {
          ...entry,
          slots,
          checkIn: latestCheckIn.get(entry.account.id),
          order: next ? minutesOf(next.startTime) : 24 * 60 + minutesOf(slots.at(-1)!.startTime),
        };
      })
      .sort((a, b) => a.order - b.order);
  }, [bookings.data, latestCheckIn, now]);

  const waiting = arrivals.filter((entry) => !entry.checkIn);
  const arrived = arrivals.filter((entry) => entry.checkIn);
  const shown = filter === 'waiting' ? waiting : arrived;
  const log = useMemo(
    () => [...(today.data ?? [])].sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt)),
    [today.data],
  );

  const memberSlots = member ? (arrivals.find((entry) => entry.account.id === member.accountId)?.slots ?? []) : [];
  const pendingId = checkIn.isPending ? checkIn.variables : undefined;

  const choose = (next: Member | null) => {
    setMember(next);
    setRefusal(null);
    if (next) setFlash(null);
    if (!next) focusSearch();
  };

  const run = (accountId: string, fromPanel: boolean) => {
    setRefusal(null);
    checkIn.mutate(accountId, {
      onSuccess: (created) => {
        setFlash(created);
        setMember(null);
        focusSearch();
      },
      onError: (error) => {
        const apiError = toApiError(error);
        if (apiError.code === ERROR_CODE.CHECKIN_NOT_ALLOWED && fromPanel) setRefusal(apiError.message);
        else message.error(describeApiError(error));
      },
    });
  };

  useCounterHotkeys({
    onSearch: () => choose(null),
    onPay: member && !checkIn.isPending ? () => run(member.accountId, true) : undefined,
  });

  return (
    <>
      <PageHeader title="Check-in" />

      <div className="mb-4 grid grid-cols-3 gap-3 sm:max-w-xl">
        <Stat label="Có lịch hôm nay" value={bookings.data ? arrivals.length : '…'} />
        <Stat label="Đã vào" value={arrived.length} tone="text-sc-success" />
        <Stat label="Chưa đến" value={bookings.data ? waiting.length : '…'} tone="text-sc-warning" />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-2xl border border-sc-border bg-white px-5 py-5 shadow-xs">
            {flash && (
              <div className="flex items-center gap-3 rounded-xl border border-sc-success/30 bg-sc-success/10 px-4 py-3">
                <CheckCircle2 size={22} className="shrink-0 text-sc-success" />
                <span className="flex-1 text-[14px] text-sc-ink">
                  Đã check-in <b>{flash.account.fullName}</b> lúc {timeOf(flash.checkedInAt)}
                </span>
                <Button
                  type="text"
                  size="small"
                  aria-label="Ẩn"
                  icon={<X size={15} />}
                  onClick={() => setFlash(null)}
                />
              </div>
            )}

            {member ? (
              <MemberPanel
                member={member}
                slots={memberSlots}
                checkIn={latestCheckIn.get(member.accountId)}
                now={now}
                refusal={refusal}
                pending={pendingId === member.accountId}
                onConfirm={() => run(member.accountId, true)}
                onClear={() => choose(null)}
              />
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-sc-primary text-sc-lime">
                    <UserSearch size={22} />
                  </span>
                  <div>
                    <h2 className="m-0 font-display text-[22px] font-extrabold text-sc-ink uppercase">
                      Hội viên đến quầy
                    </h2>
                    <p className="m-0 text-[14.5px] text-sc-muted">
                      Tìm theo SĐT hoặc tên, hoặc bấm Check-in ngay trong danh sách bên dưới.
                    </p>
                  </div>
                </div>
                <CounterCustomerSearch
                  allowGuest={false}
                  placeholder="Nhập SĐT, tên hoặc email hội viên"
                  hint="Hội viên có lớp học hôm nay cũng tìm ở đây để check-in."
                  onSelect={(buyer) => buyer.kind === 'MEMBER' && choose(buyer)}
                />
              </>
            )}
          </section>

          <section className="rounded-2xl border border-sc-border bg-white px-5 py-4 shadow-xs">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="m-0 flex items-center gap-2 font-display text-[17px] font-bold tracking-[0.04em] text-sc-ink uppercase">
                <CalendarClock size={18} />
                Khách đặt sân hôm nay
              </h2>
              <Segmented
                value={filter}
                onChange={(value) => setFilter(value as 'waiting' | 'in')}
                options={[
                  { value: 'waiting', label: `Chưa đến (${waiting.length})` },
                  { value: 'in', label: `Đã vào (${arrived.length})` },
                ]}
              />
            </div>
            {bookings.isPending ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : shown.length ? (
              <ul className="m-0 flex max-h-[560px] list-none flex-col gap-2 overflow-y-auto p-0 pr-1">
                {shown.map((arrival) => (
                  <ArrivalRow
                    key={arrival.account.id}
                    arrival={arrival}
                    now={now}
                    pending={pendingId === arrival.account.id}
                    onCheckIn={() => run(arrival.account.id, false)}
                    onOpen={() =>
                      choose({
                        kind: 'MEMBER',
                        accountId: arrival.account.id,
                        fullName: arrival.account.fullName,
                        phone: null,
                      })
                    }
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                title={filter === 'waiting' ? 'Không còn ai chờ check-in' : 'Chưa có ai vào hôm nay'}
                description={
                  filter === 'waiting'
                    ? 'Mọi khách đặt sân hôm nay đã check-in, hoặc hôm nay chưa có lượt đặt nào.'
                    : 'Khách check-in xong sẽ hiện ở đây.'
                }
              />
            )}
          </section>
        </div>

        <aside className="rounded-2xl border border-sc-border bg-white shadow-xs xl:sticky xl:top-20">
          <header className="flex items-center justify-between gap-2 border-b border-sc-border-soft px-4 py-3">
            <h2 className="m-0 flex items-center gap-2 font-display text-[17px] font-bold tracking-[0.04em] text-sc-ink uppercase">
              <ScanLine size={18} />
              Nhật ký hôm nay
            </h2>
            <span className="rounded-full bg-sc-paper px-2.5 py-0.5 text-[13.5px] font-semibold text-sc-ink-2">
              {log.length} lượt
            </span>
          </header>
          {today.isPending ? (
            <div className="p-4">
              <Skeleton active paragraph={{ rows: 5 }} />
            </div>
          ) : log.length ? (
            <ol className="m-0 flex max-h-[calc(100vh-14rem)] list-none flex-col overflow-y-auto p-0">
              {log.map((entry) => (
                <li
                  key={entry.id}
                  className={`flex items-center gap-3 border-b border-sc-border-soft px-4 py-2.5 last:border-b-0 ${
                    entry.id === flash?.id ? 'bg-sc-success/10' : ''
                  }`}
                >
                  <b className="w-11 shrink-0 font-display text-[16px] tabular-nums text-sc-ink">
                    {timeOf(entry.checkedInAt)}
                  </b>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-[15px] font-semibold text-sc-ink">{entry.account.fullName}</span>
                    <span className="truncate text-[13.5px] text-sc-muted">bởi {entry.checkedBy.fullName}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="px-4 py-10">
              <EmptyState title="Chưa có lượt check-in nào" description="Lượt check-in hôm nay sẽ hiện ở đây." />
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
