import type { CheckoutQuoteBody } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import type { Role } from '~/generated/prisma/client';
import { toQuoteResponse } from '~/mappers/checkout.mapper';
import walletRepository from '~/repositories/wallet.repository';
import { buildContext } from '~/services/checkout/context';
import { prepareOrder } from '~/services/checkout/prepareOrder';

class CheckoutService {
  quote = async (actor: { id: string; role: Role }, body: CheckoutQuoteBody) => {
    const ctx = await buildContext(prisma, actor, body.buyer);
    const [prepared, wallet] = await Promise.all([
      prepareOrder(prisma, ctx, body.items, body.couponCode),
      ctx.buyer.kind === 'MEMBER' ? walletRepository.findBalance(ctx.buyer.accountId) : null,
    ]);
    return toQuoteResponse(prepared, wallet ? Number(wallet.walletBalance) : null);
  };
}

export default new CheckoutService();
