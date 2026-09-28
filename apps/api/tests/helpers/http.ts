import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import app from '~/app';
import { prisma } from '~/configs/db';
import type { Prisma, Role } from '~/generated/prisma/client';
import { signAccessToken } from '~/utils/jwt';

export interface Viewer {
  id: string;
  role: Role;
}

const PROFILE_KEY = {
  MANAGER: 'managerProfile',
  RECEPTIONIST: 'receptionistProfile',
  COACH: 'coachProfile',
  MEMBER: 'memberProfile',
} as const satisfies Record<Role, keyof Prisma.AccountCreateInput>;

export const startServer = async (basePath: string) => {
  const server: Server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return { server, request: buildFetcher(`http://localhost:${port}/api/v1${basePath}`) };
};

export const createAccount = (role: Role, email: string, data: Partial<Prisma.AccountCreateInput> = {}) =>
  prisma.account.create({
    data: {
      email,
      passwordHash: 'hash',
      fullName: role,
      role,
      passwordChangedAt: new Date('2020-01-01'),
      [PROFILE_KEY[role]]: { create: {} },
      ...data,
    },
  });

export const cookieOf = (viewer: Viewer) => `access_token=${signAccessToken(viewer.id, viewer.role)}`;

export const readResult = async <T>(response: Response) => ((await response.json()) as { result: T }).result;

export const readCode = async (response: Response) => ((await response.json()) as { code: string }).code;

export const buildFetcher = (baseUrl: string) => (method: string, path: string, viewer: Viewer, body?: unknown) =>
  fetch(baseUrl + path, {
    method,
    headers: {
      Cookie: cookieOf(viewer),
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
