import type { ListMaintenancesQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import maintenanceService from '~/services/maintenance.service';
import { getClientIp } from '~/utils/request';

class MaintenanceController {
  list = async (req: Request, res: Response) => {
    const result = await maintenanceService.list(req.query as unknown as ListMaintenancesQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  preview = async (req: Request, res: Response) => {
    const result = await maintenanceService.preview(req.body);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  create = async (req: Request, res: Response) => {
    const result = await maintenanceService.create(req.user!.id, req.body, getClientIp(req));
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đã tạo lịch bảo trì', result }));
  };

  update = async (req: Request, res: Response) => {
    const result = await maintenanceService.update(req.user!.id, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã cập nhật lịch bảo trì', result }));
  };

  remove = async (req: Request, res: Response) => {
    await maintenanceService.remove(req.user!.id, req.params.id as string, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã xóa lịch bảo trì' }));
  };
}

export default new MaintenanceController();
