import type { ListBookingsQuery, ListMyBookingsQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import bookingService from '~/services/booking.service';

class BookingController {
  listMine = async (req: Request, res: Response) => {
    const result = await bookingService.listMine(req.user!.id, req.query as unknown as ListMyBookingsQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  list = async (req: Request, res: Response) => {
    const result = await bookingService.list(req.query as unknown as ListBookingsQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  get = async (req: Request, res: Response) => {
    const result = await bookingService.get(req.user!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  listPackagesMine = async (req: Request, res: Response) => {
    const result = await bookingService.listPackagesMine(req.user!.id);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };
}

export default new BookingController();
