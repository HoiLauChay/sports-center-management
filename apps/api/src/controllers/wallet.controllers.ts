import type { WalletQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import walletService from '~/services/wallet.service';

class WalletController {
  getMine = async (req: Request, res: Response) => {
    const wallet = await walletService.getMine(req.user!.id, req.query as unknown as WalletQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: wallet }));
  };

  getForMember = async (req: Request, res: Response) => {
    const wallet = await walletService.getForMember(req.params.id as string, req.query as unknown as WalletQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: wallet }));
  };
}

export default new WalletController();
