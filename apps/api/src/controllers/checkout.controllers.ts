import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import checkoutService from '~/services/checkout/checkout.service';

class CheckoutController {
  quote = async (req: Request, res: Response) => {
    const quote = await checkoutService.quote(req.user!, req.body);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: quote }));
  };
}

export default new CheckoutController();
