import type { Account } from '@sports-center/shared';

const STORAGE_KEY = 'sc_mock_auth_user';

export const MOCK_DEMO_ACCOUNTS: Account[] = [
  {
    id: 'mock-member-thu',
    email: 'member1@sportscenter.local',
    fullName: 'Hoàng Anh Thư',
    phone: '0903000001',
    dateOfBirth: '1998-05-12',
    gender: 'FEMALE',
    address: 'Hà Nội',
    avatarUrl: null,
    role: 'MEMBER',
    status: 'ACTIVE',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    profile: {
      walletBalance: 5_000_000,
      emergencyContact: '0903999999',
      fitnessGoals: 'Rèn luyện sức khỏe, tăng thể lực',
      healthNotes: null,
    },
  },
  {
    id: 'mock-coach-minh',
    email: 'coach1@sportscenter.local',
    fullName: 'Nguyễn Văn Minh',
    phone: '0901000001',
    dateOfBirth: '1992-08-20',
    gender: 'MALE',
    address: 'Hà Nội',
    avatarUrl: null,
    role: 'COACH',
    status: 'ACTIVE',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    profile: {
      bio: 'Huấn luyện viên chuyên môn Cầu lông & Bơi lội',
      experience: '6 năm huấn luyện',
      certifications: 'Chứng chỉ HLV Cầu lông cấp Quốc gia',
      coverImageUrl: null,
    },
  },
  {
    id: 'mock-manager-admin',
    email: 'manager@sportscenter.local',
    fullName: 'Quản lý Trung tâm',
    phone: '0900000000',
    dateOfBirth: '1988-10-10',
    gender: 'MALE',
    address: 'Hà Nội',
    avatarUrl: null,
    role: 'MANAGER',
    status: 'ACTIVE',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    profile: {
      staffNotes: null,
    },
  },
  {
    id: 'mock-reception-ha',
    email: 'reception1@sportscenter.local',
    fullName: 'Nguyễn Thu Hà',
    phone: '0902000001',
    dateOfBirth: '1995-03-15',
    gender: 'FEMALE',
    address: 'Hà Nội',
    avatarUrl: null,
    role: 'RECEPTIONIST',
    status: 'ACTIVE',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    profile: {
      staffNotes: null,
    },
  },
];

export function getMockSession(): Account | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Account;
  } catch {
    return null;
  }
}

export function setMockSession(account: Account): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
  } catch {
    /* ignore storage error */
  }
}

export function clearMockSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore storage error */
  }
}

export function findMockAccount(email: string): Account | undefined {
  const norm = email.trim().toLowerCase();
  return MOCK_DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === norm);
}
