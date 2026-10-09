import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import facilityPackageService from '~/services/facilityPackage.service';

class FacilityPackageController {
  listMine = async (req: Request, res: Response) => {
    const result = await facilityPackageService.listMine(req.user!.id);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  preview = async (req: Request, res: Response) => {
    const preview = await facilityPackageService.preview({ id: req.user!.id, role: 'MEMBER' }, req.body);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: preview }));
  };
}

export default new FacilityPackageController();
