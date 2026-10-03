import type { OrderItemType } from '@sports-center/shared';

import type { AnyLineHandler } from '~/services/checkout/types';

export const lineHandlers: Partial<Record<OrderItemType, AnyLineHandler>> = {};
