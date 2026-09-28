import { updateSettingsBodySchema } from '@sports-center/shared';
import { Router } from 'express';

import settingController from '~/controllers/setting.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const settingRouter = Router();

settingRouter.use(auth);
settingRouter.get('/', settingController.get);
settingRouter.patch('/', isRole('MANAGER'), validate({ body: updateSettingsBodySchema }), settingController.update);

export default settingRouter;
