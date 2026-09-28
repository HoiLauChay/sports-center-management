import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import settingService from '~/services/setting.service';
import { getClientIp } from '~/utils/request';

class SettingController {
  get = async (_req: Request, res: Response) => {
    const setting = await settingService.get();
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: setting }));
  };

  update = async (req: Request, res: Response) => {
    const setting = await settingService.update(req.user!.id, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Cập nhật cấu hình thành công', result: setting }));
  };
}

export default new SettingController();
