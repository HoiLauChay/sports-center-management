import type { Account } from '@sports-center/shared';
import { mockRequest } from '~/lib/mock/errors';
import { supportDb } from '../mocks/support';
import type { CreateSupportBody, ListSupportQuery, UpdateSupportBody } from '../types';

const personOf = (user: Pick<Account, 'id' | 'fullName'>) => ({ id: user.id, fullName: user.fullName });

/**
 * Support requests (`/support-requests`, `/me/support-requests`). Mock until #85 ships: replace each body with the
 * matching `privateApi` call, the types already follow `api.design.md`.
 */
export const supportService = {
  create: (user: Account, body: CreateSupportBody) => mockRequest(() => supportDb.create(personOf(user), body)),

  listMine: (user: Account) => mockRequest(() => supportDb.listMine(user.id), 150),

  list: (query: ListSupportQuery) => mockRequest(() => supportDb.list(query), 150),

  get: (id: string) => mockRequest(() => supportDb.get(id), 100),

  update: (user: Account, id: string, body: UpdateSupportBody) =>
    mockRequest(() => supportDb.update(personOf(user), id, body)),
};
