import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import classTrainingService from '~/services/classTraining.service';
import { getClientIp } from '~/utils/request';

class ClassTrainingController {
  plans = async (req: Request, res: Response) => {
    const result = await classTrainingService.plans(req.user!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  saveClassPlan = async (req: Request, res: Response) => {
    const result = await classTrainingService.savePlan(req.user!, req.params.id as string, null, req.body);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã lưu kế hoạch lớp', result }));
  };

  saveMemberPlan = async (req: Request, res: Response) => {
    const result = await classTrainingService.savePlan(
      req.user!,
      req.params.id as string,
      req.params.accountId as string,
      req.body,
    );
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã lưu kế hoạch học viên', result }));
  };

  suggestClassPlan = async (req: Request, res: Response) => {
    const result = await classTrainingService.suggestPlan(req.user!, req.params.id as string, null);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã tạo gợi ý kế hoạch', result }));
  };

  suggestMemberPlan = async (req: Request, res: Response) => {
    const result = await classTrainingService.suggestPlan(
      req.user!,
      req.params.id as string,
      req.params.accountId as string,
    );
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã tạo gợi ý kế hoạch', result }));
  };

  saveReview = async (req: Request, res: Response) => {
    const result = await classTrainingService.saveReview(
      req.user!,
      req.params as { id: string; accountId: string; milestone: 'MID' | 'FINAL' },
      req.body,
      getClientIp(req),
    );
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã lưu đánh giá tiến độ', result }));
  };

  myTraining = async (req: Request, res: Response) => {
    const result = await classTrainingService.myTraining(req.user!.id, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  roster = async (req: Request, res: Response) => {
    const result = await classTrainingService.roster(req.user!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  student = async (req: Request, res: Response) => {
    const result = await classTrainingService.student(
      req.user!,
      req.params.id as string,
      req.params.accountId as string,
    );
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };
}

export default new ClassTrainingController();
