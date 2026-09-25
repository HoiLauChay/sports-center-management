import type { Account, Role } from '@sports-center/shared';

export class ForbiddenError extends Error {
  constructor() {
    super('FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export function requireRole(...roles: Role[]) {
  return ({ context }: { context: { user: Account } }) => {
    if (!roles.includes(context.user.role)) throw new ForbiddenError();
  };
}

export function safeRedirectPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return undefined;
  }
  const url = new URL(value, window.location.origin);
  return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : undefined;
}
