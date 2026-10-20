import type { SubscribeMemberBody, TerminateMembershipBody } from '@sports-center/shared';
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

  cancelMine = async (req: Request, res: Response) => {
    const result = await memberMembershipService.cancel(
      req.user!,
      req.user!.id,
      req.params.id as string,
      getClientIp(req),
    );
    res
      .status(HTTP_STATUS.OK)
      .json(new ResponseClient({ message: 'Đã hủy gói, dùng được đến hết hạn và không hoàn tiền', result }));
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
      .json(new ResponseClient({ message: 'Đã hủy gói, dùng được đến hết hạn và không hoàn tiền', result }));
  };

  subscribeForMember = async (req: Request, res: Response) => {
    const result = await memberMembershipService.subscribe(
      req.user!,
      req.params.id as string,
      req.body as SubscribeMemberBody,
      getClientIp(req),
    );
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đã đăng ký gói cho thành viên', result }));
  };

  terminateForMember = async (req: Request, res: Response) => {
    const { reason } = req.body as TerminateMembershipBody;
    const result = await memberMembershipService.terminate(
      req.user!,
      req.params.id as string,
      req.params.membershipId as string,
      reason,
      getClientIp(req),
    );
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã chấm dứt gói, không hoàn tiền', result }));
  };
}

export default new MemberMembershipController();
