import { describe, expect, mock, test } from 'bun:test';
import type { Request, Response } from 'express';

import { isRole } from '~/middlewares/auth.middlewares';
import { ErrorWithStatus } from '~/rules/error';

const run = (user: Request['user']) => {
  const next = mock();
  isRole('MANAGER', 'RECEPTIONIST')({ user } as Request, {} as Response, next);
  return next.mock.calls[0]?.[0] as unknown;
};

describe('isRole', () => {
  test('allows any of the listed roles', () => {
    expect(run({ id: '1', role: 'MANAGER' })).toBeUndefined();
    expect(run({ id: '1', role: 'RECEPTIONIST' })).toBeUndefined();
  });

  test('rejects other roles with 403', () => {
    const err = run({ id: '1', role: 'MEMBER' });
    expect(err).toBeInstanceOf(ErrorWithStatus);
    expect((err as ErrorWithStatus).status).toBe(403);
  });

  test('rejects requests without an authenticated user', () => {
    expect((run(undefined) as ErrorWithStatus).status).toBe(403);
  });
});
