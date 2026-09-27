import type { Request, Response } from 'express';

import type { ListUsersQueryParsed } from '@sports-center/shared';
import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import usersService from '~/services/users.service';

class UsersController {
  list = async (req: Request, res: Response) => {
    const result = await usersService.list(
      req.query as unknown as ListUsersQueryParsed,
      req.user!.role as 'MANAGER' | 'RECEPTIONIST',
    );
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ result }));
  };

  getById = async (req: Request, res: Response) => {
    const result = await usersService.getById(req.params.id as string, req.user!.role as 'MANAGER' | 'RECEPTIONIST');
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ result }));
  };
}

export default new UsersController();
