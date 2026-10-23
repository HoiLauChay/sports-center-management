import {
  activateAccountBodySchema,
  activationBodySchema,
  changePasswordBodySchema,
  firstPasswordBodySchema,
  loginBodySchema,
  loginStartBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  sendOtpBodySchema,
  setPasswordBodySchema,
  updateMeBodySchema,
  verifyOtpBodySchema,
} from '@sports-center/shared';
import { Router } from 'express';

import authController from '~/controllers/auth.controllers';
import { auth } from '~/middlewares/auth.middlewares';
import {
  activateLimit,
  activationLimit,
  loginLimit,
  loginStartLimit,
  refreshLimit,
  registerLimit,
  resetPasswordLimit,
  sendOtpLimit,
  setPasswordLimit,
  verifyOtpLimit,
} from '~/middlewares/rateLimit.middlewares';
import { validate } from '~/utils/validation';

const authRouter = Router();

authRouter.get('/google', authController.googleAuth);
authRouter.get('/google/callback', authController.googleCallback);

authRouter.post('/send-otp', sendOtpLimit, validate({ body: sendOtpBodySchema }), authController.sendOtp);
authRouter.post('/register', registerLimit, validate({ body: registerBodySchema }), authController.register);
authRouter.post('/login/start', loginStartLimit, validate({ body: loginStartBodySchema }), authController.loginStart);
authRouter.post('/login', loginLimit, validate({ body: loginBodySchema }), authController.login);
authRouter.post('/verify-otp', verifyOtpLimit, validate({ body: verifyOtpBodySchema }), authController.verifyOtp);
authRouter.post(
  '/set-password',
  setPasswordLimit,
  validate({ body: setPasswordBodySchema }),
  authController.setPassword,
);
authRouter.post(
  '/activation',
  activationLimit,
  validate({ body: activationBodySchema }),
  authController.checkActivation,
);
authRouter.post('/activate', activateLimit, validate({ body: activateAccountBodySchema }), authController.activate);
authRouter.post('/refresh', refreshLimit, authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.post('/logout-all', auth, authController.logoutAll);
authRouter.get('/me', auth, authController.getMe);
authRouter.patch('/me', auth, validate({ body: updateMeBodySchema }), authController.updateMe);
authRouter.post('/change-password', auth, validate({ body: changePasswordBodySchema }), authController.changePassword);
authRouter.post('/first-password', auth, validate({ body: firstPasswordBodySchema }), authController.setFirstPassword);
authRouter.post(
  '/reset-password',
  resetPasswordLimit,
  validate({ body: resetPasswordBodySchema }),
  authController.resetPassword,
);

export default authRouter;
