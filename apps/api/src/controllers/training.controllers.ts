import type { MyEvaluationsQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import trainingService from '~/services/training.service';
import { getClientIp } from '~/utils/request';

class TrainingController {
  getNote = async (req: Request, res: Response) => {
    const result = await trainingService.getNote(req.user!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  saveNote = async (req: Request, res: Response) => {
    const result = await trainingService.saveNote(req.user!, req.params.id as string, req.body);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã lưu ghi chú buổi học', result }));
  };

  listSessionEvaluations = async (req: Request, res: Response) => {
    const result = await trainingService.listSessionEvaluations(req.user!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  createEvaluation = async (req: Request, res: Response) => {
    const result = await trainingService.createEvaluation(
      req.user!,
      req.params.id as string,
      req.body,
      getClientIp(req),
    );
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đã đánh giá học viên', result }));
  };

  updateEvaluation = async (req: Request, res: Response) => {
    const result = await trainingService.updateEvaluation(
      req.user!,
      req.params.id as string,
      req.body,
      getClientIp(req),
    );
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã cập nhật đánh giá', result }));
  };

  removeEvaluation = async (req: Request, res: Response) => {
    await trainingService.removeEvaluation(req.user!, req.params.id as string, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã xóa đánh giá' }));
  };

  listMyEvaluations = async (req: Request, res: Response) => {
    const result = await trainingService.listMyEvaluations(req.user!.id, req.query as unknown as MyEvaluationsQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  announce = async (req: Request, res: Response) => {
    const result = await trainingService.announce(req.user!, req.params.id as string, req.body);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã gửi thông báo lớp', result }));
  };
}

export default new TrainingController();
