import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import membershipService from '~/services/membership.service';

class MembershipController {
  list = async (req: Request, res: Response) => {
    const isManager = req.user?.role === 'MANAGER';
    const memberships = await membershipService.list(isManager);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: memberships }));
  };
}

export default new MembershipController();
