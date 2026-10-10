import type { CheckoutItemInput, ErrorCode, ItemSnapshotBase, OrderItemType } from '@sports-center/shared';

import type { Prisma, Role } from '~/generated/prisma/client';
import type { SettingRow } from '~/repositories/setting.repository';
import type { PlannedUse } from '~/services/schedule.service';

export type Db = Prisma.TransactionClient;

export type LineSnapshot = ItemSnapshotBase & Record<string, unknown>;

export interface BenefitPeriod {
  packageName: string;
  periodStart: string;
  periodEnd: string;
  gymAccess: boolean;
  bookingDiscountPct: number;
  classDiscountPct: number;
  freeBookingSlotsPerMonth: number;
}

export interface ActiveBenefits {
  current: BenefitPeriod | null;
  periodOn(date: string): BenefitPeriod | null;
}

export interface PlannedLine {
  lineNumber: number;
  accountId: string | null;
  type: OrderItemType;
  data: unknown;
  uses: PlannedUse[];
}

export interface CheckoutContext {
  buyer: { kind: 'MEMBER'; accountId: string } | { kind: 'GUEST'; name: string; phone: string };
  actor: { id: string; role: Role };
  now: Date;
  settings: SettingRow;
  benefits: ActiveBenefits | null;
  planned: PlannedLine[];
}

export interface LineError {
  code: ErrorCode;
  message: string;
}

export type LineResult<Data, Snapshot> =
  | {
      ok: true;
      subtotal: number;
      membershipDiscount: number;
      snapshot: Snapshot;
      data: Data;
      uses?: PlannedUse[];
    }
  | { ok: false; error: LineError };

export interface PricedLine<Data> {
  lineNumber: number;
  total: number;
  data: Data;
}

export interface LineHandler<Input extends CheckoutItemInput, Data, Snapshot extends LineSnapshot> {
  type: Input['type'];
  guestAllowed: boolean;
  needsScheduleLock: boolean;
  lockTargets(input: Input): { facilities?: string[]; classes?: string[]; memberMemberships?: string[] };
  prepare(db: Db, ctx: CheckoutContext, input: Input): Promise<LineResult<Data, Snapshot>>;
  verify(tx: Prisma.TransactionClient, ctx: CheckoutContext, line: PricedLine<Data>): Promise<LineError | null>;
  fulfill(
    tx: Prisma.TransactionClient,
    ctx: CheckoutContext,
    line: PricedLine<Data>,
    orderItemId: string,
  ): Promise<{ refId: string }>;
}

export type AnyLineHandler = LineHandler<CheckoutItemInput, unknown, LineSnapshot>;

export interface PreparedLine {
  lineNumber: number;
  input: CheckoutItemInput;
  result: LineResult<unknown, LineSnapshot>;
  couponDiscount: number;
  couponId: string | null;
}

export interface AppliedCoupon {
  id: string | null;
  code: string;
  name: string | null;
  valid: boolean;
  discount: number;
  error?: string;
}

export interface PreparedOrder {
  lines: PreparedLine[];
  coupon: AppliedCoupon | null;
  subtotal: number;
  membershipDiscount: number;
  couponDiscount: number;
  total: number;
  valid: boolean;
  membershipName: string | null;
}

export interface CounterOrderPayload {
  buyer: CheckoutContext['buyer'];
  prepared: PreparedOrder;
}
