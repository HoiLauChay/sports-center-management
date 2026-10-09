import type { ListClassesQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import classService from '~/services/class.service';
import coachAssignmentService from '~/services/coachAssignment.service';
import { getClientIp } from '~/utils/request';

class ClassController {
  listForCoach = async (req: Request, res: Response) => {
    const result = await classService.listForCoach(req.user!.id);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  cancel = async (req: Request, res: Response) => {
    const result = await classService.cancel(req.user!.id, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã hủy lớp học', result }));
  };

  registerCoach = async (req: Request, res: Response) => {
    const result = await coachAssignmentService.register(req.user!.id, req.params.id as string, getClientIp(req));
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đã đăng ký dạy', result }));
  };

  listCoachRegistrations = async (req: Request, res: Response) => {
    const result = await coachAssignmentService.list(req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  assignCoach = async (req: Request, res: Response) => {
    const result = await coachAssignmentService.assign(
      req.user!.id,
      req.params.id as string,
      req.body,
      getClientIp(req),
    );
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã phân công huấn luyện viên', result }));
  };

  withdrawCoach = async (req: Request, res: Response) => {
    const result = await coachAssignmentService.withdraw(req.user!.id, req.params.id as string, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã rút khỏi lớp', result }));
  };

  list = async (req: Request, res: Response) => {
    const result = await classService.list(req.user!, req.query as unknown as ListClassesQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  get = async (req: Request, res: Response) => {
    const result = await classService.get(req.user!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  update = async (req: Request, res: Response) => {
    const result = await classService.update(req.user!.id, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã cập nhật lớp học', result }));
  };

  approve = async (req: Request, res: Response) => {
    const result = await classService.approve(req.user!.id, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã duyệt lớp học', result }));
  };

  reject = async (req: Request, res: Response) => {
    const result = await classService.reject(req.user!.id, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã từ chối lớp học', result }));
  };

  create = async (req: Request, res: Response) => {
    const result = await classService.create(req.user!.id, req.body, getClientIp(req));
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đã tạo lớp học', result }));
  };
}

export default new ClassController();
