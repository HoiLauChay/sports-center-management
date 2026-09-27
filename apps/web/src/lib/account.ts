import type { Account, CoachProfile, Gender, MemberProfile, StaffProfile } from '@sports-center/shared';

export const GENDER_LABEL: Record<Gender, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

export function getMemberProfile(user: Account) {
  return user.role === 'MEMBER' ? (user.profile as MemberProfile) : null;
}

export function getCoachProfile(user: Account) {
  return user.role === 'COACH' ? (user.profile as CoachProfile) : null;
}

export function getStaffProfile(user: Account) {
  return user.role === 'RECEPTIONIST' || user.role === 'MANAGER' ? (user.profile as StaffProfile) : null;
}
