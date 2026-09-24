import type { Account } from '@sports-center/shared';

import type { AccountWithProfile } from '~/repositories/account.repository';

const toProfile = (account: AccountWithProfile): Account['profile'] => {
  switch (account.role) {
    case 'MEMBER': {
      const profile = account.memberProfile!;
      return {
        emergencyContact: profile.emergencyContact,
        fitnessGoals: profile.fitnessGoals,
        healthNotes: profile.healthNotes,
        walletBalance: profile.walletBalance.toNumber(),
      };
    }
    case 'COACH': {
      const profile = account.coachProfile!;
      return {
        bio: profile.bio,
        experience: profile.experience,
        certifications: profile.certifications,
        coverImageUrl: profile.coverImageUrl,
      };
    }
    case 'RECEPTIONIST':
      return { staffNotes: account.receptionistProfile!.staffNotes };
    case 'MANAGER':
      return { staffNotes: account.managerProfile!.staffNotes };
  }
};

export const toAccountResponse = (account: AccountWithProfile): Account => ({
  id: account.id,
  email: account.email,
  fullName: account.fullName,
  phone: account.phone,
  dateOfBirth: account.dateOfBirth?.toISOString().slice(0, 10) ?? null,
  gender: account.gender,
  address: account.address,
  avatarUrl: account.avatarUrl,
  role: account.role,
  status: account.status,
  emailVerifiedAt: account.emailVerifiedAt?.toISOString() ?? null,
  createdAt: account.createdAt.toISOString(),
  profile: toProfile(account),
});
