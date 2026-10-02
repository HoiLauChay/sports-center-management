import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import courseService from '~/services/course.service';
import { getClientIp } from '~/utils/request';

class CourseController {
  list = async (_req: Request, res: Response) => {
    const courses = await courseService.list();
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: courses }));
  };

  create = async (req: Request, res: Response) => {
    const course = await courseService.create(req.user!.id, req.body, getClientIp(req));
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đã tạo khóa học', result: course }));
  };

  update = async (req: Request, res: Response) => {
    const course = await courseService.update(req.user!.id, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Cập nhật khóa học thành công', result: course }));
  };

  remove = async (req: Request, res: Response) => {
    const course = await courseService.remove(req.user!.id, req.params.id as string, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã xóa khóa học', result: course }));
  };
}

export default new CourseController();
