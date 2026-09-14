import { Router } from 'express';

import authController from '~/controllers/auth.controllers';
import { auth } from '~/middlewares/auth.middlewares';
import { authLimiter, loginLimiter, otpLimiter } from '~/middlewares/rateLimit.middlewares';
import { loginSchema, registerSchema, sendOtpSchema } from '~/schemas/auth.schema';
import { validate } from '~/utils/validation';

const authRouter = Router();

authRouter.post('/send-otp', otpLimiter, validate(sendOtpSchema), authController.sendOtp);
authRouter.post('/register', authLimiter, validate(registerSchema), authController.register);
authRouter.post('/login', loginLimiter, validate(loginSchema), authController.login);
authRouter.post('/refresh', authLimiter, authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.post('/logout-all', auth, authController.logoutAll);
authRouter.get('/me', auth, authController.getMe);

export default authRouter;
