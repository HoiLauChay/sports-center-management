import type { MyAttendanceQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { ResponseClient } from '~/rules/response';
import attendanceService from '~/services/attendance.service';

class AttendanceController {
  list = async (req: Request, res: Response) => {
    const result = await attendanceService.list(req.user!, req.params.id as string);
    res.json(new ResponseClient({ message: 'Thành công', result }));
  };

  save = async (req: Request, res: Response) => {
    const result = await attendanceService.save(req.user!, req.params.id as string, req.body, req.ip);
    res.json(new ResponseClient({ message: 'Đã lưu điểm danh', result }));
  };

  listMine = async (req: Request, res: Response) => {
    const result = await attendanceService.listMine(req.user!.id, req.query as MyAttendanceQuery);
    res.json(new ResponseClient({ message: 'Thành công', result }));
  };
}

export default new AttendanceController();
