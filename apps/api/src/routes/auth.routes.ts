import { Router } from 'express';

import authController from '~/controllers/auth.controllers';
import { auth } from '~/middlewares/auth.middlewares';
import { authLimiter, loginLimiter, otpLimiter, refreshLimiter } from '~/middlewares/rateLimit.middlewares';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  sendOtpSchema,
} from '~/schemas/auth.schema';
import { validate } from '~/utils/validation';

const authRouter = Router();

authRouter.post('/send-otp', otpLimiter, validate(sendOtpSchema), authController.sendOtp);
authRouter.post('/register', authLimiter, validate(registerSchema), authController.register);
authRouter.post('/login', loginLimiter, validate(loginSchema), authController.login);
authRouter.post('/refresh', refreshLimiter, authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.post('/logout-all', auth, authController.logoutAll);
authRouter.get('/me', auth, authController.getMe);
authRouter.post('/change-password', auth, validate(changePasswordSchema), authController.changePassword);
authRouter.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);

export default authRouter;
