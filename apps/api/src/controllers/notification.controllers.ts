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

  markRead = async (req: Request, res: Response) => {
    await notificationService.markRead(req.user!.id, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã đánh dấu đã đọc' }));
  };

  markAllRead = async (req: Request, res: Response) => {
    await notificationService.markAllRead(req.user!.id);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã đánh dấu tất cả đã đọc' }));
  };
}

export default new NotificationController();
