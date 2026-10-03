import type { ListBankTransactionsQuery, ReconciliationQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import bankTransactionService from '~/services/bankTransaction.service';
import { getClientIp } from '~/utils/request';

class BankTransactionController {
  list = async (req: Request, res: Response) => {
    const page = await bankTransactionService.list(req.query as unknown as ListBankTransactionsQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: page }));
  };

  resolve = async (req: Request, res: Response) => {
    const row = await bankTransactionService.resolve(req.user!.id, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã gán giao dịch cho thành viên', result: row }));
  };

  ignore = async (req: Request, res: Response) => {
    const row = await bankTransactionService.ignore(req.user!.id, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã bỏ qua giao dịch', result: row }));
  };

  reconcile = async (req: Request, res: Response) => {
    const result = await bankTransactionService.reconcile(req.query as unknown as ReconciliationQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };
}

export default new BankTransactionController();
