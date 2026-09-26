import { createUploadBodySchema } from '@sports-center/shared';
import { Router } from 'express';

import uploadController from '~/controllers/upload.controllers';
import { auth } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const uploadRouter = Router();

uploadRouter.post('/token', auth, validate({ body: createUploadBodySchema }), uploadController.createToken);

export default uploadRouter;
