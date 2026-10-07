import type { ListMyInvoicesQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import invoiceService from '~/services/invoice.service';

class InvoiceController {
  createTopUp = async (req: Request, res: Response) => {
    const invoice = await invoiceService.createTopUp(req.user!, req.body);
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đã tạo hóa đơn nạp ví', result: invoice }));
  };

  cancel = async (req: Request, res: Response) => {
    const invoice = await invoiceService.cancel(req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã hủy hóa đơn', result: invoice }));
  };

  listMine = async (req: Request, res: Response) => {
    const page = await invoiceService.listMine(req.user!.id, req.query as unknown as ListMyInvoicesQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: page }));
  };

  getById = async (req: Request, res: Response) => {
    const invoice = await invoiceService.get(req.user!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: invoice }));
  };
}

export default new InvoiceController();
