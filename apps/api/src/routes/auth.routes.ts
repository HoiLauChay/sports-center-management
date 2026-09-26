import {
  changePasswordBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  sendOtpBodySchema,
  updateMeBodySchema,
} from '@sports-center/shared';
import { Router } from 'express';

import authController from '~/controllers/auth.controllers';
import { auth } from '~/middlewares/auth.middlewares';
import {
  loginLimit,
  refreshLimit,
  registerLimit,
  resetPasswordLimit,
  sendOtpLimit,
} from '~/middlewares/rateLimit.middlewares';
import { validate } from '~/utils/validation';

const authRouter = Router();

authRouter.post('/send-otp', sendOtpLimit, validate({ body: sendOtpBodySchema }), authController.sendOtp);
authRouter.post('/register', registerLimit, validate({ body: registerBodySchema }), authController.register);
authRouter.post('/login', loginLimit, validate({ body: loginBodySchema }), authController.login);
authRouter.post('/refresh', refreshLimit, authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.post('/logout-all', auth, authController.logoutAll);
authRouter.get('/me', auth, authController.getMe);
authRouter.patch('/me', auth, validate({ body: updateMeBodySchema }), authController.updateMe);
authRouter.post('/change-password', auth, validate({ body: changePasswordBodySchema }), authController.changePassword);
authRouter.post(
  '/reset-password',
  resetPasswordLimit,
  validate({ body: resetPasswordBodySchema }),
  authController.resetPassword,
);

export default authRouter;
