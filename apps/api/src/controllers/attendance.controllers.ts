import type { MyAttendanceQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import attendanceService from '~/services/attendance.service';
import { getClientIp } from '~/utils/request';

class AttendanceController {
  list = async (req: Request, res: Response) => {
    const result = await attendanceService.list(req.user!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  save = async (req: Request, res: Response) => {
    const result = await attendanceService.save(req.user!, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã lưu điểm danh', result }));
  };

  listMine = async (req: Request, res: Response) => {
    const result = await attendanceService.listMine(req.user!.id, req.query as unknown as MyAttendanceQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };
}

export default new AttendanceController();
