import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import invoiceService from '~/services/invoice.service';

class InvoiceController {
  createTopUp = async (req: Request, res: Response) => {
    const invoice = await invoiceService.createTopUp(req.user!, req.body);
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đã tạo hóa đơn nạp ví', result: invoice }));
  };
}

export default new InvoiceController();
