import type { Role } from '@sports-center/shared';

const AREA_ROLES: ReadonlyArray<readonly [prefix: string, roles: readonly Role[]]> = [
  ['/admin', ['MANAGER']],
  ['/reception', ['RECEPTIONIST']],
  ['/coach', ['COACH']],
];

const MEMBER_ONLY_PATHS = [
  '/wallet',
  '/memberships',
  '/classes',
  '/bookings',
  '/schedule',
  '/cart',
  '/orders',
  '/enrollments',
  '/support',
  '/training',
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function allowedRolesFor(pathname: string): readonly Role[] | null {
  for (const [prefix, roles] of AREA_ROLES) {
    if (matchesPrefix(pathname, prefix)) return roles;
  }
  if (MEMBER_ONLY_PATHS.some((p) => matchesPrefix(pathname, p))) return ['MEMBER'];
  return null;
}

export function canAccess(role: Role, pathname: string) {
  const roles = allowedRolesFor(pathname);
  return roles === null || roles.includes(role);
}

export class ForbiddenError extends Error {
  constructor() {
    super('FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export function safeRedirectPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return undefined;
  }
  const url = new URL(value, window.location.origin);
  return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : undefined;
}
