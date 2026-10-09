import type { ListBookingsQuery, ListMyBookingsQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { ResponseClient } from '~/rules/response';
import bookingService from '~/services/booking.service';

class BookingController {
  listMine = async (req: Request, res: Response) => {
    const result = await bookingService.listMine(req.user!.id, req.query as unknown as ListMyBookingsQuery);
    res.json(new ResponseClient({ message: 'Thành công', result }));
  };
  list = async (req: Request, res: Response) => {
    const result = await bookingService.list(req.query as unknown as ListBookingsQuery);
    res.json(new ResponseClient({ message: 'Thành công', result }));
  };
  get = async (req: Request, res: Response) => {
    const result = await bookingService.get(req.user!, req.params.id as string);
    res.json(new ResponseClient({ message: 'Thành công', result }));
  };
  listPackagesMine = async (req: Request, res: Response) => {
    const result = await bookingService.listPackagesMine(req.user!.id);
    res.json(new ResponseClient({ message: 'Thành công', result }));
  };
}
export default new BookingController();
