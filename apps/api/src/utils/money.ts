import { Prisma } from '~/generated/prisma/client';

const assertMoney = (value: number, name: string) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative integer`);
};

export const roundMoney = (value: Prisma.Decimal | string | number) =>
  new Prisma.Decimal(value).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();

export const percentOf = (amount: number, percent: number) => {
  assertMoney(amount, 'amount');
  return roundMoney(new Prisma.Decimal(amount).mul(percent).div(100));
};

export const allocate = (total: number, weights: number[]) => {
  assertMoney(total, 'total');
  weights.forEach((weight) => assertMoney(weight, 'weight'));

  const weightSum = weights.reduce((sum, weight) => sum + BigInt(weight), 0n);
  if (weightSum === 0n) {
    if (total !== 0) throw new RangeError('Cannot allocate a non-zero total over zero weights');
    return weights.map(() => 0);
  }

  const shares = weights.map((weight, index) => {
    const product = BigInt(total) * BigInt(weight);
    return { index, amount: product / weightSum, remainder: product % weightSum };
  });

  let leftover = BigInt(total) - shares.reduce((sum, { amount }) => sum + amount, 0n);
  const byRemainder = [...shares].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  );
  for (const share of byRemainder) {
    if (leftover === 0n) break;
    share.amount += 1n;
    leftover -= 1n;
  }

  return shares.map(({ amount }) => Number(amount));
};

export const splitEvenly = (total: number, parts: number) =>
  allocate(
    total,
    Array.from({ length: parts }, () => 1),
  );
