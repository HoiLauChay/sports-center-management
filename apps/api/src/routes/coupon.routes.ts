import { couponIdParamsSchema, createCouponBodySchema, updateCouponBodySchema } from '@sports-center/shared';
import { Router } from 'express';

import couponController from '~/controllers/coupon.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const couponRouter = Router();

couponRouter.use(auth, isRole('MANAGER'));
couponRouter.get('/', couponController.list);
couponRouter.post('/', validate({ body: createCouponBodySchema }), couponController.create);
couponRouter.patch(
  '/:id',
  validate({ params: couponIdParamsSchema, body: updateCouponBodySchema }),
  couponController.update,
);
couponRouter.delete('/:id', validate({ params: couponIdParamsSchema }), couponController.remove);

export default couponRouter;
