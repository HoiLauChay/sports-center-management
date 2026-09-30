import { Router } from 'express';

import membershipController from '~/controllers/membership.controllers';
import { auth } from '~/middlewares/auth.middlewares';

const membershipRouter = Router();

membershipRouter.use(auth);
membershipRouter.get('/', membershipController.list);

export default membershipRouter;
