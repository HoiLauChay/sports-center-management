import type { ApiResponse, Facility, MembershipPackage, Person, Role, SystemSettings } from '@sports-center/shared';
import { facilitiesService } from '~/features/catalog/services/facilities.service';
import { membershipsService } from '~/features/memberships/services/memberships.service';
import { myMembershipsService } from '~/features/memberships/services/myMemberships.service';
import type { MyMemberships } from '~/features/memberships/types';
import { settingsService } from '~/features/settings/services/settings.service';
import { privateApi } from '~/lib/http';

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
