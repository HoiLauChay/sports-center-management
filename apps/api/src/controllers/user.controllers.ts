import type { ListUsersQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import userService from '~/services/user.service';

class UserController {
  list = async (req: Request, res: Response) => {
    const page = await userService.list(req.user!, req.query as unknown as ListUsersQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: page }));
  };

  getById = async (req: Request, res: Response) => {
    const account = await userService.getById(req.user!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: account }));
  };
}

export default new UserController();
