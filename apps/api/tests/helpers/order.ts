import { expect } from 'bun:test';

import { prisma } from '~/configs/db';

export const expectOrderConsistent = async (orderId: string) => {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const sum = (pick: (item: (typeof order.items)[number]) => unknown) =>
    order.items.reduce((total, item) => total + Number(pick(item)), 0);

  expect(Number(order.subtotal)).toBe(sum((item) => item.subtotal));
  expect(Number(order.membershipDiscountAmount)).toBe(sum((item) => item.membershipDiscountAmount));
  expect(Number(order.couponDiscountAmount)).toBe(sum((item) => item.couponDiscountAmount));
  expect(Number(order.totalAmount)).toBe(sum((item) => item.totalAmount));
  return order;
};
