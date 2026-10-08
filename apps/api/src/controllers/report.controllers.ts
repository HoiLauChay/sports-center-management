import type { ReportRangeQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import reportService from '~/services/report.service';

class ReportController {
  overview = async (_req: Request, res: Response) => {
    res
      .status(HTTP_STATUS.OK)
      .json(new ResponseClient({ message: 'Thành công', result: await reportService.overview() }));
  };

  revenue = async (req: Request, res: Response) => {
    const result = await reportService.revenue(req.query as unknown as ReportRangeQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  wallet = async (req: Request, res: Response) => {
    const result = await reportService.wallet(req.query as unknown as ReportRangeQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };
}

export default new ReportController();
