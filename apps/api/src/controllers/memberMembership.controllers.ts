import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import memberMembershipService from '~/services/memberMembership.service';
import { getClientIp } from '~/utils/request';

class MemberMembershipController {
  listMine = async (req: Request, res: Response) => {
    const result = await memberMembershipService.list(req.user!.id);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  listForMember = async (req: Request, res: Response) => {
    const result = await memberMembershipService.list(req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  setAutoRenew = async (req: Request, res: Response) => {
    const result = await memberMembershipService.setAutoRenew(
      req.user!.id,
      req.params.id as string,
      req.body,
      getClientIp(req),
    );
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã cập nhật tự động gia hạn', result }));
  };

  cancelMine = async (req: Request, res: Response) => {
    const result = await memberMembershipService.cancel(
      req.user!,
      req.user!.id,
      req.params.id as string,
      getClientIp(req),
    );
    res
      .status(HTTP_STATUS.OK)
      .json(new ResponseClient({ message: 'Đã hủy gói, quyền lợi dừng ngay và không hoàn tiền', result }));
  };

  cancelForMember = async (req: Request, res: Response) => {
    const result = await memberMembershipService.cancel(
      req.user!,
      req.params.id as string,
      req.params.membershipId as string,
      getClientIp(req),
    );
    res
      .status(HTTP_STATUS.OK)
      .json(new ResponseClient({ message: 'Đã hủy gói, quyền lợi dừng ngay và không hoàn tiền', result }));
  };
}

export default new MemberMembershipController();
