import type { ReportDateQuery, ReportExportQuery, ReportRangeQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import reportService from '~/services/report.service';

class ReportController {
  exportFile = async (req: Request, res: Response) => {
    const { fileName, contentType, body } = await reportService.exportFile(req.query as unknown as ReportExportQuery);
    res.status(HTTP_STATUS.OK).type(contentType).attachment(fileName).send(body);
  };

  members = async (req: Request, res: Response) => {
    const result = await reportService.members(req.query as unknown as ReportDateQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  facilities = async (req: Request, res: Response) => {
    const result = await reportService.facilities(req.query as unknown as ReportDateQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  courses = async (req: Request, res: Response) => {
    const result = await reportService.courses(req.query as unknown as ReportDateQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

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
