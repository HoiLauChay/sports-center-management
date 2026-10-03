import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import checkoutService from '~/services/checkout/checkout.service';

class CheckoutController {
  checkout = async (req: Request, res: Response) => {
    const order = await checkoutService.checkout(req.user!, req.body);
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Thanh toán thành công', result: order }));
  };

  quote = async (req: Request, res: Response) => {
    const quote = await checkoutService.quote(req.user!, req.body);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: quote }));
  };
}

export default new CheckoutController();
