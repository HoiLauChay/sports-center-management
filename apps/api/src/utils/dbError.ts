import { Prisma } from '~/generated/prisma/client';

const RETRYABLE_CODES = new Set(['40001', '40P01']);

interface DriverAdapterCause {
  originalCode?: string;
  constraint?: { index?: string };
}

const getCause = (err: unknown): DriverAdapterCause | undefined => {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return undefined;
  const meta = err.meta as { driverAdapterError?: { cause?: DriverAdapterCause } } | undefined;
  return meta?.driverAdapterError?.cause;
};

export const isRetryableTransactionError = (err: unknown) =>
  (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') ||
  RETRYABLE_CODES.has(getCause(err)?.originalCode ?? '');

export const isUniqueViolation = (err: unknown, indexSuffix: string) =>
  err instanceof Prisma.PrismaClientKnownRequestError &&
  err.code === 'P2002' &&
  (getCause(err)?.constraint?.index ?? '').endsWith(indexSuffix);
