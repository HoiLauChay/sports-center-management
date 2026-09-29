import type { ListAuditLogsQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import auditService from '~/services/audit.service';

class AuditController {
  list = async (req: Request, res: Response) => {
    const page = await auditService.list(req.query as unknown as ListAuditLogsQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: page }));
  };
}

export default new AuditController();
