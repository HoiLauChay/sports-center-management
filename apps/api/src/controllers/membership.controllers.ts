import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import membershipService from '~/services/membership.service';
import { getClientIp } from '~/utils/request';

class MembershipController {
  list = async (req: Request, res: Response) => {
    const isManager = req.user?.role === 'MANAGER';
    const memberships = await membershipService.list(isManager);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: memberships }));
  };

  create = async (req: Request, res: Response) => {
    const membership = await membershipService.create(req.user!.id, req.body, getClientIp(req));
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đã tạo gói thành viên', result: membership }));
  };

  update = async (req: Request, res: Response) => {
    const membership = await membershipService.update(req.user!.id, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã cập nhật gói thành viên', result: membership }));
  };

  remove = async (req: Request, res: Response) => {
    await membershipService.remove(req.user!.id, req.params.id as string, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã xóa gói thành viên' }));
  };
}

export default new MembershipController();
