import type { Account, FacilitySlot, MemberScheduleItem } from '@sports-center/shared';
import { useMemo } from 'react';
import type { CheckoutBuyer } from '~/features/checkout/types';
import { useMemberSchedule, useMySchedule } from '~/features/schedule/hooks/useSchedule';

const isLive = (item: MemberScheduleItem) =>
  item.kind === 'BOOKING' ? item.status === 'CONFIRMED' : item.status === 'SCHEDULED';

const describe = (item: MemberScheduleItem, who: string) =>
  item.kind === 'BOOKING'
    ? `${who} đã đặt ${item.facility.name} lúc ${item.startTime}–${item.endTime}`
    : `${who} có buổi học lớp ${item.class.name} lúc ${item.startTime}–${item.endTime} tại ${item.facility.name}`;

export function useScheduleConflicts(user: Account, buyer: CheckoutBuyer | undefined, date: string) {
  const range = { from: date, to: date };
  const buyerId = buyer && 'accountId' in buyer ? buyer.accountId : undefined;
  const mine = useMySchedule(range, user.role === 'MEMBER' && !buyer);
  const theirs = useMemberSchedule(buyerId, range);
  const items = buyerId ? theirs.data : mine.data;
  const who = buyerId ? 'Người mua' : 'Bạn';

  return useMemo(() => {
    const live = (items ?? []).filter((item) => item.date === date && isLive(item));
    return (slot: FacilitySlot) => {
      const hit = live.find((item) => item.startTime < slot.endTime && slot.startTime < item.endTime);
      return hit ? describe(hit, who) : null;
    };
  }, [items, date, who]);
}
