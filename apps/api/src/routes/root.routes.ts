import { Router } from 'express';

import auditRouter from '~/routes/audit.routes';
import authRouter from '~/routes/auth.routes';
import cronRouter from '~/routes/cron.routes';
import facilityRouter from '~/routes/facility.routes';
import membershipRouter from '~/routes/membership.routes';
import notificationRouter from '~/routes/notification.routes';
import settingRouter from '~/routes/setting.routes';
import { coachSpecializationRouter, managerSpecializationRouter } from '~/routes/specialization.routes';
import sportRouter from '~/routes/sport.routes';
import uploadRouter from '~/routes/upload.routes';
import userRouter from '~/routes/user.routes';
import { myWalletRouter } from '~/routes/wallet.routes';
import { ResponseClient } from '~/rules/response';

const rootRouter = Router();

rootRouter.get('/health', (_req, res) => {
  res.json(new ResponseClient({ message: 'OK' }));
});

rootRouter.use('/audit-logs', auditRouter);
rootRouter.use('/auth', authRouter);
rootRouter.use('/coach/specializations', coachSpecializationRouter);
rootRouter.use('/cron', cronRouter);
rootRouter.use('/facilities', facilityRouter);
rootRouter.use('/memberships', membershipRouter);
rootRouter.use('/me/notifications', notificationRouter);
rootRouter.use('/me/wallet', myWalletRouter);
rootRouter.use('/settings', settingRouter);
rootRouter.use('/specializations', managerSpecializationRouter);
rootRouter.use('/sports', sportRouter);
rootRouter.use('/uploads', uploadRouter);
rootRouter.use('/users', userRouter);

export default rootRouter;
