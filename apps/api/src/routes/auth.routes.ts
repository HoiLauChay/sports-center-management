import {
  changePasswordBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  sendOtpBodySchema,
} from '@sports-center/shared';
import { Router } from 'express';

import authController from '~/controllers/auth.controllers';
import { auth } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const authRouter = Router();

authRouter.post('/send-otp', validate({ body: sendOtpBodySchema }), authController.sendOtp);
authRouter.post('/register', validate({ body: registerBodySchema }), authController.register);
authRouter.post('/login', validate({ body: loginBodySchema }), authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.post('/logout-all', auth, authController.logoutAll);
authRouter.get('/me', auth, authController.getMe);
authRouter.post('/change-password', auth, validate({ body: changePasswordBodySchema }), authController.changePassword);
authRouter.post('/reset-password', validate({ body: resetPasswordBodySchema }), authController.resetPassword);

export default authRouter;
