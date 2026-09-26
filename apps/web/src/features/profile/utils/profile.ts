import type { Account, CoachProfile, Gender, MemberProfile } from '@sports-center/shared';

export const GENDER_LABEL: Record<Gender, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

export function getMemberProfile(user: Account) {
  return user.role === 'MEMBER' ? (user.profile as MemberProfile) : null;
}

export function getCoachProfile(user: Account) {
  return user.role === 'COACH' ? (user.profile as CoachProfile) : null;
}
