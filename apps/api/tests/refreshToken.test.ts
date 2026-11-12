import { beforeEach, describe, expect, test } from 'bun:test';

import { prisma } from '~/configs/db';
import authService from '~/services/auth.service';
import { hashToken } from '~/utils/token';
import { resetDatabase } from './helpers/db';
import { createAccount } from './helpers/http';

beforeEach(resetDatabase);

const seedToken = async (raw: string) => {
  const account = await createAccount('MEMBER', `${raw}@example.com`);
  await prisma.refreshToken.create({
    data: { accountId: account.id, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + 60_000) },
  });
  return account;
};

const refusal = (raw: string) =>
  authService.refresh(raw, {}).then(
    () => null,
    (error: { code?: string }) => error.code ?? 'UNKNOWN',
  );

const active = (accountId: string) => prisma.refreshToken.count({ where: { accountId, revokedAt: null } });

describe('refresh token reuse', () => {
  test('a token rotated a moment ago still refreshes, an old rotation ends every session', async () => {
    const account = await seedToken('rotated');
    await authService.refresh('rotated', {});
    await authService.refresh('rotated', {});
    expect(await active(account.id)).toBe(2);

    await prisma.refreshToken.update({
      where: { tokenHash: hashToken('rotated') },
      data: { rotatedAt: new Date(Date.now() - 60_000) },
    });
    expect(await refusal('rotated')).toBe('TOKEN_INVALID');
    expect(await active(account.id)).toBe(0);
  });

  test('a token revoked by a logout or a password change gets no grace', async () => {
    const account = await seedToken('left');
    await authService.logout('left');
    expect(await refusal('left')).toBe('TOKEN_INVALID');

    await prisma.refreshToken.create({
      data: { accountId: account.id, tokenHash: hashToken('stolen'), expiresAt: new Date(Date.now() + 60_000) },
    });
    await authService.logoutAll(account.id);
    expect(await refusal('stolen')).toBe('TOKEN_INVALID');
    expect(await active(account.id)).toBe(0);
  });

  test('a logout right after a rotation ends the grace of the replaced token', async () => {
    const account = await seedToken('replaced');
    const { refreshToken } = await authService.refresh('replaced', {});
    await authService.logout(refreshToken);
    expect(await refusal('replaced')).toBe('TOKEN_INVALID');
    expect(await active(account.id)).toBe(0);
  });

  test('a password change right after a rotation ends the grace of the replaced token', async () => {
    const account = await seedToken('before-reset');
    await authService.refresh('before-reset', {});
    await authService.logoutAll(account.id);
    expect(await refusal('before-reset')).toBe('TOKEN_INVALID');
    expect(await active(account.id)).toBe(0);
  });
});
