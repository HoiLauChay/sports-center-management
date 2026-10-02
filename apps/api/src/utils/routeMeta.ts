import type { RequestHandler } from 'express';
import type { z } from 'zod';

import type { Role } from '~/generated/prisma/client';

export interface RouteMeta {
  schemas?: { body?: z.ZodType; query?: z.ZodType; params?: z.ZodType };
  security?: 'cookie' | 'sepay' | 'cron';
  roles?: Role[];
}

const registry = new WeakMap<RequestHandler, RouteMeta>();

export const describeHandler = <T extends RequestHandler>(handler: T, meta: RouteMeta) => {
  registry.set(handler, meta);
  return handler;
};

export const readHandlerMeta = (handler: RequestHandler) => registry.get(handler);
