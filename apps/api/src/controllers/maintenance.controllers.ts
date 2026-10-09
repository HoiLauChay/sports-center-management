import type { ListMaintenancesQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import maintenanceService from '~/services/maintenance.service';

class MaintenanceController {
  list = async (req: Request, res: Response) => {
    const result = await maintenanceService.list(req.query as unknown as ListMaintenancesQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  preview = async (req: Request, res: Response) => {
    const result = await maintenanceService.preview(req.body);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };
}

export default new MaintenanceController();
