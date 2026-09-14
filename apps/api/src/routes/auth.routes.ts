import { Router } from 'express';

import authController from '~/controllers/auth.controllers';
import { authLimiter, otpLimiter } from '~/middlewares/rateLimit.middlewares';
import { registerSchema, sendOtpSchema } from '~/schemas/auth.schema';
import { validate } from '~/utils/validation';

const authRouter = Router();

authRouter.post('/send-otp', otpLimiter, validate(sendOtpSchema), authController.sendOtp);
authRouter.post('/register', authLimiter, validate(registerSchema), authController.register);

export default authRouter;
