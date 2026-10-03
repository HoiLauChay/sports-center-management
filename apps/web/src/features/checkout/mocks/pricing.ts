import type { ApiResponse, Facility, MembershipPackage, Person, Role, SystemSettings } from '@sports-center/shared';
import { bookingProblem, packageDates, previewPackage } from '~/features/bookings/mocks/schedule';
import type { BookingBenefit } from '~/features/bookings/types';
import { facilitiesService } from '~/features/catalog/services/facilities.service';
import { classesDb, ensureClassSeed } from '~/features/classes/mocks/classes';
import { couponsDb } from '~/features/coupons/mocks/coupons';
import { membershipsService } from '~/features/memberships/services/memberships.service';
import { myMembershipsService } from '~/features/memberships/services/myMemberships.service';
import type { MyMemberships } from '~/features/memberships/types';
import { settingsService } from '~/features/settings/services/settings.service';
import { usersService } from '~/features/users/services/users.service';
import { formatDate, formatVND } from '~/lib/format';
import { privateApi } from '~/lib/http';
import { commerceStore } from '~/lib/mock/commerce';
import { mockErrors } from '~/lib/mock/errors';
import { addDays, nowVN, overlaps, toMinutes, todayVN } from '~/lib/time';
import type { CheckoutItemInput, OrderItemType, Quote, QuoteItem, QuoteRequest } from '../types';

/** Rounds half up to whole dong (BR: 0,5 làm tròn lên). */
export const roundVnd = (value: number) => Math.floor(value + 0.5);

export interface Actor {
  id: string;
  role: Role;
  fullName: string;
}

export interface Catalog {
  facilities: Facility[];
  settings: SystemSettings;
  packages: MembershipPackage[];
}

let catalogCache: { at: number; value: Promise<Catalog> } | null = null;

/** Facilities, settings and membership packages come from the real API; cached briefly because quotes are frequent. */
export function loadCatalog(): Promise<Catalog> {
  if (catalogCache && Date.now() - catalogCache.at < 20_000) return catalogCache.value;
  const value = Promise.all([facilitiesService.list(), settingsService.get(), membershipsService.list()]).then(
    ([facilities, settings, packages]) => ({ facilities, settings, packages }),
  );
  value.catch(() => {
    catalogCache = null;
  });
  catalogCache = { at: Date.now(), value };
  return value;
}

export type BuyerInfo = { kind: 'MEMBER'; person: Person } | { kind: 'GUEST'; name: string; phone: string };

export async function resolveBuyer(actor: Actor, buyer: QuoteRequest['buyer']): Promise<BuyerInfo> {
  if (actor.role === 'MEMBER') return { kind: 'MEMBER', person: { id: actor.id, fullName: actor.fullName } };
  if (!buyer) throw mockErrors.invalid('body.buyer', 'Vui lòng chọn người mua');
  if ('guest' in buyer) {
    const name = buyer.guest.name.trim();
    const phone = buyer.guest.phone.trim();
    if (!name) throw mockErrors.invalid('body.buyer.guest.name', 'Vui lòng nhập tên khách');
    if (!phone) throw mockErrors.invalid('body.buyer.guest.phone', 'Vui lòng nhập số điện thoại khách');
    return { kind: 'GUEST', name, phone };
  }
  const account = await usersService.get(buyer.accountId);
  if (account.role !== 'MEMBER') throw mockErrors.invalid('body.buyer.accountId', 'Người mua phải là thành viên');
  return { kind: 'MEMBER', person: { id: account.id, fullName: account.fullName } };
}

export interface Benefits {
  gymAccess: boolean;
  bookingDiscountPct: number;
  classDiscountPct: number;
  freeBookingSlotsPerMonth: number;
  /** Free slots the real API already counted for the current calendar month. */
  freeSlotsUsedThisMonth: number;
  currentPackageId: string;
  currentEndDate: string;
}

/** Benefits of the buyer's current membership period, or `null` when there is none (or the API cannot tell yet). */
export async function loadBenefits(actor: Actor, buyer: BuyerInfo): Promise<Benefits | null> {
  if (buyer.kind !== 'MEMBER') return null;
  try {
    const data: MyMemberships =
      actor.role === 'MEMBER' && buyer.person.id === actor.id
        ? await myMembershipsService.list()
        : (
            await privateApi.get<ApiResponse<MyMemberships>>(
              `/users/${encodeURIComponent(buyer.person.id)}/memberships`,
            )
          ).data.result;
    const current = data.current;
    if (!current?.currentBenefits) return null;
    return {
      ...current.currentBenefits,
      freeSlotsUsedThisMonth: current.freeSlotsUsedThisMonth,
      currentPackageId: current.package.id,
      currentEndDate: current.endDate,
    };
  } catch {
    // `GET /users/{id}/memberships` (#93) is not live yet: price without membership benefits.
    return null;
  }
}

export function allocate(total: number, bases: number[]): number[] {
  const sum = bases.reduce((acc, base) => acc + base, 0);
  if (sum <= 0 || total <= 0) return bases.map(() => 0);
  const raw = bases.map((base) => (total * base) / sum);
  const result = raw.map((value) => Math.floor(value));
  let rest = total - result.reduce((acc, value) => acc + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .filter(({ index }) => bases[index]! > 0)
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let cursor = 0; rest > 0 && order.length; cursor = (cursor + 1) % order.length) {
    result[order[cursor]!.index]! += 1;
    rest -= 1;
  }
  return result;
}

export interface BookingPart {
  date: string;
  startTime: string;
  endTime: string;
  list: number;
  price: number;
  benefit: BookingBenefit;
}

export interface EvaluatedLine {
  item: QuoteItem;
  parts: BookingPart[];
  facility?: Facility;
  plan?: MembershipPackage;
  classId?: string;
  periodStart?: string;
  periodEnd?: string;
}

export interface Evaluation {
  quote: Quote;
  lines: EvaluatedLine[];
  buyer: BuyerInfo;
  couponCode: string | undefined;
}

const slotsOf = (settings: SystemSettings, startTime: string, endTime: string) =>
  Math.max(1, Math.round((toMinutes(endTime) - toMinutes(startTime)) / settings.slotDurationMinutes));

function freeSlotsUsedInMonth(accountId: string, month: string) {
  return commerceStore
    .get()
    .bookings.filter(
      (booking) =>
        booking.status === 'CONFIRMED' &&
        booking.account?.id === accountId &&
        booking.benefit === 'FREE_SLOT' &&
        booking.date.startsWith(month),
    ).length;
}

interface PricingContext {
  catalog: Catalog;
  buyer: BuyerInfo;
  benefits: Benefits | null;
  /** Free slots consumed by earlier lines of the same draft, per month. */
  freeUsage: Map<string, number>;
}

function priceBooking(
  context: PricingContext,
  facility: Facility,
  date: string,
  startTime: string,
  endTime: string,
): BookingPart {
  const { settings } = context.catalog;
  const slots = slotsOf(settings, startTime, endTime);
  const list = facility.pricePerSlot * slots;
  const { benefits, buyer } = context;
  if (!benefits || buyer.kind !== 'MEMBER') return { date, startTime, endTime, list, price: list, benefit: 'NONE' };
  if (benefits.gymAccess && facility.type === 'GYM')
    return { date, startTime, endTime, list, price: 0, benefit: 'GYM_ACCESS' };

  const month = date.slice(0, 7);
  const realUsed = month === todayVN().slice(0, 7) ? benefits.freeSlotsUsedThisMonth : 0;
  const left =
    benefits.freeBookingSlotsPerMonth -
    realUsed -
    freeSlotsUsedInMonth(buyer.person.id, month) -
    (context.freeUsage.get(month) ?? 0);
  if (left >= slots) {
    context.freeUsage.set(month, (context.freeUsage.get(month) ?? 0) + slots);
    return { date, startTime, endTime, list, price: 0, benefit: 'FREE_SLOT' };
  }
  if (benefits.bookingDiscountPct > 0) {
    return {
      date,
      startTime,
      endTime,
      list,
      price: list - roundVnd((list * benefits.bookingDiscountPct) / 100),
      benefit: 'DISCOUNT',
    };
  }
  return { date, startTime, endTime, list, price: list, benefit: 'NONE' };
}

interface Busy {
  date: string;
  startTime: string;
  endTime: string;
  label: string;
}

/** Everything a member already has booked or attends, for BR_2.13 (no two things at the same time). */
function memberBusy(accountId: string): Busy[] {
  const bookings = commerceStore
    .get()
    .bookings.filter((booking) => booking.status === 'CONFIRMED' && booking.account?.id === accountId)
    .map((booking) => ({
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      label: `lượt đặt ${booking.facility.name}`,
    }));
  const sessions = classesDb.enrolledSessions(accountId).map((session) => ({
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    label: `buổi học lớp ${classesDb.findClass(session.classId)?.name ?? ''}`.trim(),
  }));
  return [...bookings, ...sessions];
}

/** The time ranges one selection occupies (used to compare lines of the same draft with each other). */
function occupied(selection: CheckoutItemInput): Busy[] {
  switch (selection.type) {
    case 'FACILITY_BOOKING':
      return [
        {
          date: selection.date,
          startTime: selection.startTime,
          endTime: selection.endTime,
          label: 'đặt sân trong đơn',
        },
      ];
    case 'FACILITY_PACKAGE':
      return packageDates(selection).map((date) => ({
        date,
        startTime: selection.startTime,
        endTime: selection.endTime,
        label: 'gói định kỳ trong đơn',
      }));
    case 'COURSE_ENROLLMENT':
      return classesDb
        .sessionsOf(selection.classId)
        .filter((session) => session.status === 'SCHEDULED')
        .map((session) => ({
          date: session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          label: `lớp ${classesDb.findClass(selection.classId)?.name ?? ''} trong đơn`.trim(),
        }));
    case 'MEMBERSHIP':
      return [];
  }
}

const clash = (a: Busy[], b: Busy[]) =>
  a
    .flatMap((left) =>
      b
        .filter(
          (right) => left.date === right.date && overlaps(left.startTime, left.endTime, right.startTime, right.endTime),
        )
        .map((right) => ({ left, right })),
    )
    .at(0);

interface LineBuild {
  type: OrderItemType;
  snapshot: Record<string, unknown>;
  parts: BookingPart[];
  subtotal: number;
  membershipDiscount: number;
  error?: { code: string; message: string };
  facility?: Facility;
  plan?: MembershipPackage;
  classId?: string;
  periodStart?: string;
  periodEnd?: string;
}

function buildLine(
  context: PricingContext,
  selection: CheckoutItemInput,
  index: number,
  all: CheckoutItemInput[],
): LineBuild {
  const { catalog, buyer, benefits } = context;
  const { settings } = catalog;
  const base: LineBuild = { type: selection.type, snapshot: {}, parts: [], subtotal: 0, membershipDiscount: 0 };
  const fail = (code: string, message: string): LineBuild => ({ ...base, error: { code, message } });
  const others = all.filter((_, other) => other !== index);

  if (buyer.kind === 'GUEST' && selection.type !== 'FACILITY_BOOKING') {
    return fail('GUEST_NOT_ALLOWED', 'Khách vãng lai chỉ được đặt sân lẻ');
  }

  if (selection.type === 'FACILITY_BOOKING') {
    const facility = catalog.facilities.find((entry) => entry.id === selection.facilityId);
    const part = facility
      ? priceBooking(context, facility, selection.date, selection.startTime, selection.endTime)
      : undefined;
    const sport = facility?.sports[0]?.name ?? '';
    const built: LineBuild = {
      ...base,
      facility,
      parts: part ? [part] : [],
      subtotal: part?.list ?? 0,
      membershipDiscount: part ? part.list - part.price : 0,
      snapshot: facility
        ? {
            facilityId: facility.id,
            facilityName: facility.name,
            sportName: sport,
            date: selection.date,
            startTime: selection.startTime,
            endTime: selection.endTime,
            slots: slotsOf(settings, selection.startTime, selection.endTime),
            pricePerSlot: facility.pricePerSlot,
            benefit: part?.benefit ?? 'NONE',
          }
        : {},
    };
    const pending = others.flatMap((other) =>
      other.type === 'FACILITY_BOOKING'
        ? [{ facilityId: other.facilityId, date: other.date, startTime: other.startTime, endTime: other.endTime }]
        : [],
    );
    const problem = bookingProblem(
      facility,
      settings,
      {
        facilityId: selection.facilityId,
        date: selection.date,
        startTime: selection.startTime,
        endTime: selection.endTime,
      },
      pending,
    );
    if (problem) return { ...built, error: problem };
    if (buyer.kind === 'MEMBER') {
      const mine = clash(occupied(selection), memberBusy(buyer.person.id));
      if (mine)
        return {
          ...built,
          error: {
            code: 'MEMBER_TIME_CONFLICT',
            message: `Trùng giờ với ${mine.right.label} (${mine.right.startTime}–${mine.right.endTime})`,
          },
        };
      const inCart = others.map((other) => clash(occupied(selection), occupied(other))).find(Boolean);
      if (inCart)
        return { ...built, error: { code: 'CART_ITEM_CONFLICT', message: `Trùng giờ với ${inCart.right.label}` } };
    }
    return built;
  }

  if (selection.type === 'FACILITY_PACKAGE') {
    const facility = catalog.facilities.find((entry) => entry.id === selection.facilityId);
    if (!facility) return fail('INVALID_SLOT', 'Không tìm thấy sân / phòng');
    if (!selection.daysOfWeek.length || selection.weeks < 1 || selection.weeks > 12) {
      return fail('INVALID_PACKAGE', 'Cần chọn thứ trong tuần và số tuần từ 1 đến 12');
    }
    const dates = packageDates(selection);
    const parts = dates.map((date) => priceBooking(context, facility, date, selection.startTime, selection.endTime));
    const subtotal = parts.reduce((sum, part) => sum + part.list, 0);
    const built: LineBuild = {
      ...base,
      facility,
      parts,
      subtotal,
      membershipDiscount: subtotal - parts.reduce((sum, part) => sum + part.price, 0),
      snapshot: {
        facilityId: facility.id,
        facilityName: facility.name,
        sportName: facility.sports[0]?.name ?? '',
        startDate: dates[0] ?? selection.startDate,
        endDate: dates.at(-1) ?? selection.startDate,
        daysOfWeek: selection.daysOfWeek,
        startTime: selection.startTime,
        endTime: selection.endTime,
        weeks: selection.weeks,
        sessions: dates.length,
        dates,
        pricePerSlot: facility.pricePerSlot,
      },
    };
    if (buyer.kind !== 'MEMBER')
      return { ...built, error: { code: 'GUEST_NOT_ALLOWED', message: 'Gói định kỳ chỉ dành cho thành viên' } };
    if (!dates.length) return { ...built, error: { code: 'INVALID_PACKAGE', message: 'Gói không sinh được buổi nào' } };
    const preview = previewPackage(
      facility,
      settings,
      selection,
      facility.pricePerSlot,
      slotsOf(settings, selection.startTime, selection.endTime),
    );
    const bad = preview.bookings.filter((entry) => !entry.available);
    if (bad.length) {
      const reason = {
        BOOKED: 'đã có người đặt',
        CLASS: 'có lớp học',
        MAINTENANCE: 'đang bảo trì',
        CLOSED: 'ngoài giờ nhận đặt',
      } as const;
      return {
        ...built,
        error: {
          code: 'PACKAGE_CONFLICT',
          message: `Không thể đặt gói: ${bad
            .slice(0, 3)
            .map((entry) => `${formatDate(entry.date)} ${reason[entry.conflict!]}`)
            .join('; ')}${bad.length > 3 ? ` và ${bad.length - 3} buổi khác` : ''}`,
        },
      };
    }
    const mine = clash(occupied(selection), memberBusy(buyer.person.id));
    if (mine)
      return {
        ...built,
        error: {
          code: 'MEMBER_TIME_CONFLICT',
          message: `${formatDate(mine.left.date)}: trùng giờ với ${mine.right.label}`,
        },
      };
    const inCart = others.map((other) => clash(occupied(selection), occupied(other))).find(Boolean);
    if (inCart)
      return {
        ...built,
        error: {
          code: 'CART_ITEM_CONFLICT',
          message: `${formatDate(inCart.left.date)}: trùng giờ với ${inCart.right.label}`,
        },
      };
    return built;
  }

  if (selection.type === 'COURSE_ENROLLMENT') {
    const found = classesDb.findClass(selection.classId);
    if (!found) return fail('NOT_FOUND', 'Không tìm thấy lớp học');
    const pct = benefits?.classDiscountPct ?? 0;
    const price = found.course.price;
    const built: LineBuild = {
      ...base,
      classId: found.id,
      subtotal: price,
      membershipDiscount: roundVnd((price * pct) / 100),
      snapshot: {
        classId: found.id,
        className: found.name,
        courseName: found.course.name,
        coachName: found.coach?.fullName ?? '',
        facilityName: found.facility.name,
        startDate: found.startDate,
        endDate: found.endDate,
        totalSessions: found.course.totalSessions,
        price,
      },
    };
    if (buyer.kind !== 'MEMBER')
      return { ...built, error: { code: 'GUEST_NOT_ALLOWED', message: 'Đăng ký lớp cần tài khoản thành viên' } };
    if (!classesDb.enrollable(found)) {
      return {
        ...built,
        error: {
          code: 'CLASS_NOT_ENROLLABLE',
          message: found.enrolledCount >= found.maxStudents ? 'Lớp đã đủ sĩ số' : 'Lớp không còn nhận đăng ký',
        },
      };
    }
    const enrolled = commerceStore
      .get()
      .enrollments.some(
        (entry) => entry.class.id === found.id && entry.account.id === buyer.person.id && entry.status === 'ENROLLED',
      );
    if (enrolled) return { ...built, error: { code: 'ALREADY_ENROLLED', message: 'Bạn đã đăng ký lớp này' } };
    if (others.some((other) => other.type === 'COURSE_ENROLLMENT' && other.classId === found.id)) {
      return { ...built, error: { code: 'CART_ITEM_DUPLICATE', message: 'Lớp này đã có trong đơn' } };
    }
    const mine = clash(occupied(selection), memberBusy(buyer.person.id));
    if (mine)
      return {
        ...built,
        error: {
          code: 'MEMBER_TIME_CONFLICT',
          message: `${formatDate(mine.left.date)}: trùng giờ với ${mine.right.label}`,
        },
      };
    const inCart = others.map((other) => clash(occupied(selection), occupied(other))).find(Boolean);
    if (inCart)
      return {
        ...built,
        error: {
          code: 'CART_ITEM_CONFLICT',
          message: `${formatDate(inCart.left.date)}: trùng giờ với ${inCart.right.label}`,
        },
      };
    return built;
  }

  const plan = catalog.packages.find((entry) => entry.id === selection.packageId);
  if (!plan) return fail('NOT_FOUND', 'Không tìm thấy gói thành viên');
  const renewing = benefits && benefits.currentEndDate > todayVN();
  const periodStart = renewing ? benefits.currentEndDate : todayVN();
  const periodEnd = addDays(periodStart, plan.durationDays);
  const built: LineBuild = {
    ...base,
    plan,
    periodStart,
    periodEnd,
    subtotal: plan.price,
    snapshot: {
      packageId: plan.id,
      packageName: plan.name,
      durationDays: plan.durationDays,
      price: plan.price,
      periodStart,
      periodEnd,
      benefits: {
        gymAccess: plan.gymAccess,
        bookingDiscountPct: plan.bookingDiscountPct,
        classDiscountPct: plan.classDiscountPct,
        freeBookingSlotsPerMonth: plan.freeBookingSlotsPerMonth,
      },
    },
  };
  if (buyer.kind !== 'MEMBER')
    return { ...built, error: { code: 'GUEST_NOT_ALLOWED', message: 'Mua gói cần tài khoản thành viên' } };
  if (!plan.isActive) return { ...built, error: { code: 'MEMBERSHIP_NOT_FOR_SALE', message: 'Gói này đã ngừng bán' } };
  if (others.some((other) => other.type === 'MEMBERSHIP')) {
    return { ...built, error: { code: 'MEMBERSHIP_LIMIT', message: 'Mỗi đơn chỉ có tối đa một gói thành viên' } };
  }
  if (renewing && benefits.currentPackageId !== plan.id) {
    return {
      ...built,
      error: { code: 'MEMBERSHIP_ACTIVE', message: 'Đang có gói khác còn hiệu lực. Chỉ gia hạn được gói hiện tại.' },
    };
  }
  return built;
}

function evaluateCoupon(code: string | undefined, buyer: BuyerInfo, lines: LineBuild[]) {
  const none = { coupon: null as Quote['coupon'], perLine: lines.map(() => 0) };
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return none;
  const reject = (error: string) => ({
    coupon: { code: normalized, valid: false, discount: 0, error },
    perLine: none.perLine,
  });

  if (buyer.kind !== 'MEMBER') return reject('Khách vãng lai không dùng được mã giảm giá');
  const coupon = couponsDb.findByCode(normalized);
  if (!coupon) return reject('Không tìm thấy mã giảm giá');
  const now = nowVN().toISOString();
  if (!coupon.isActive) return reject('Mã đã ngừng áp dụng');
  if (now < coupon.validFrom) return reject('Mã chưa đến thời gian hiệu lực');
  if (now > coupon.validTo) return reject('Mã đã hết hạn');
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return reject('Mã đã hết lượt sử dụng');
  const used = couponsDb.usedBy(coupon.code, buyer.person.id);
  if (used >= coupon.maxUsesPerUser) return reject(`Bạn đã dùng mã này ${used}/${coupon.maxUsesPerUser} lần`);

  const eligible = lines.map(
    (line) => !line.error && (!coupon.applicableTypes || coupon.applicableTypes.includes(line.type)),
  );
  if (!eligible.some(Boolean)) return reject('Không có dịch vụ nào trong đơn thuộc loại áp dụng của mã');
  const listTotal = lines.reduce((sum, line, index) => sum + (eligible[index] ? line.subtotal : 0), 0);
  if (coupon.minOrderAmount !== null && listTotal < coupon.minOrderAmount) {
    return reject(`Cần tối thiểu ${formatVND(coupon.minOrderAmount)} cho các dịch vụ áp dụng`);
  }
  const bases = lines.map((line, index) => (eligible[index] ? line.subtotal - line.membershipDiscount : 0));
  const baseTotal = bases.reduce((sum, base) => sum + base, 0);
  if (baseTotal <= 0) return reject('Các dịch vụ áp dụng đã miễn phí, không áp được mã');

  let discount =
    coupon.discountType === 'PERCENT' ? roundVnd((baseTotal * coupon.discountValue) / 100) : coupon.discountValue;
  if (coupon.maxDiscount !== null) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(discount, baseTotal);
  return { coupon: { code: coupon.code, valid: true, discount }, perLine: allocate(discount, bases) };
}

/** Prices and validates a draft order exactly like `POST /checkout/quote` (BR_2.5, BR_3.5, BR_3.16–3.19). */
export async function evaluate(
  actor: Actor,
  request: QuoteRequest,
  balanceOf: (accountId: string) => Promise<number>,
): Promise<Evaluation> {
  const [catalog, buyer] = await Promise.all([loadCatalog(), resolveBuyer(actor, request.buyer)]);
  const benefits = await loadBenefits(actor, buyer);
  ensureClassSeed(catalog.facilities, catalog.settings);
  const context: PricingContext = { catalog, buyer, benefits, freeUsage: new Map() };

  const builds = request.items.map((selection, index) => buildLine(context, selection, index, request.items));
  const { coupon, perLine } = evaluateCoupon(request.couponCode, buyer, builds);

  const items: QuoteItem[] = builds.map((build, index) => {
    const selection = request.items[index]!;
    return {
      lineNumber: index + 1,
      type: build.type,
      selection,
      valid: !build.error,
      ...(build.error ? { error: build.error } : {}),
      snapshot: build.snapshot,
      subtotal: build.subtotal,
      membershipDiscount: build.membershipDiscount,
      couponDiscount: perLine[index]!,
      total: build.subtotal - build.membershipDiscount - perLine[index]!,
    };
  });
  const sum = (pick: (item: QuoteItem) => number) => items.reduce((total, item) => total + pick(item), 0);
  const walletBalance = buyer.kind === 'MEMBER' ? await balanceOf(buyer.person.id) : null;

  const quote: Quote = {
    items,
    coupon,
    subtotal: sum((item) => item.subtotal),
    membershipDiscount: sum((item) => item.membershipDiscount),
    couponDiscount: sum((item) => item.couponDiscount),
    total: sum((item) => item.total),
    walletBalance,
    canCheckout: items.length > 0 && items.every((item) => item.valid) && (!coupon || coupon.valid),
  };
  return {
    quote,
    buyer,
    couponCode: coupon?.valid ? coupon.code : undefined,
    lines: builds.map((build, index) => ({
      item: items[index]!,
      parts: build.parts,
      facility: build.facility,
      plan: build.plan,
      classId: build.classId,
      periodStart: build.periodStart,
      periodEnd: build.periodEnd,
    })),
  };
}
