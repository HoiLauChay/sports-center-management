import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import uploadService from '~/services/upload.service';

class UploadController {
  createToken = async (req: Request, res: Response) => {
    const ticket = await uploadService.createUploadUrl(req.user!, req.body);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: ticket }));
  };
}

export default new UploadController();
