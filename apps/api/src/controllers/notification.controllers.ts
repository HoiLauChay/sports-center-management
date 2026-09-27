import type { ListNotificationsQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import notificationService from '~/services/notification.service';

class NotificationController {
  list = async (req: Request, res: Response) => {
    const page = await notificationService.list(req.user!.id, req.query as unknown as ListNotificationsQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: page }));
  };
}

export default new NotificationController();
