import type { ListFacilitiesQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import facilityService from '~/services/facility.service';
import { getClientIp } from '~/utils/request';

class FacilityController {
  list = async (req: Request, res: Response) => {
    const isManager = req.user?.role === 'MANAGER';
    const facilities = await facilityService.list(req.query as unknown as ListFacilitiesQuery, isManager);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: facilities }));
  };

  create = async (req: Request, res: Response) => {
    const facility = await facilityService.create(req.user!.id, req.body, getClientIp(req));
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đã tạo cơ sở', result: facility }));
  };

  update = async (req: Request, res: Response) => {
    const facility = await facilityService.update(req.user!.id, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Cập nhật cơ sở thành công', result: facility }));
  };

  remove = async (req: Request, res: Response) => {
    await facilityService.remove(req.user!.id, req.params.id as string, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã xóa cơ sở' }));
  };
}

export default new FacilityController();
