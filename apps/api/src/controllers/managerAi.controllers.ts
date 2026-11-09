import type {
  AutomationKey,
  MaintenanceAnnounceBody,
  ReportInsightBody,
  UpdateAutomationBody,
} from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import managerInsightsService from '~/services/ai/managerInsights.service';
import automationService from '~/services/automation.service';

const ok = (res: Response, result: unknown) =>
  res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));

class ManagerAiController {
  reportInsight = async (req: Request, res: Response) => {
    ok(res, await managerInsightsService.reportInsight(req.body as ReportInsightBody));
  };

  digest = async (_req: Request, res: Response) => {
    ok(res, await managerInsightsService.weeklyDigest());
  };

  classReview = async (req: Request, res: Response) => {
    ok(res, await managerInsightsService.classReview(req.user!.id, req.params.id as string));
  };

  coachSuggestions = async (req: Request, res: Response) => {
    ok(res, await managerInsightsService.coachSuggestions(req.user!.id, req.params.id as string));
  };

  bankSuggestions = async (req: Request, res: Response) => {
    ok(res, { candidates: await managerInsightsService.bankSuggestions(req.params.id as string) });
  };

  maintenanceNotice = async (req: Request, res: Response) => {
    ok(res, await managerInsightsService.maintenanceNotice(req.params.id as string));
  };

  announceMaintenance = async (req: Request, res: Response) => {
    ok(
      res,
      await managerInsightsService.announceMaintenance(req.params.id as string, req.body as MaintenanceAnnounceBody),
    );
  };

  supportTriage = async (req: Request, res: Response) => {
    const viewer = { id: req.user!.id, role: req.user!.role as 'MANAGER' | 'RECEPTIONIST' };
    ok(res, await managerInsightsService.supportTriage(viewer, req.params.id as string));
  };

  automations = async (_req: Request, res: Response) => {
    ok(res, await automationService.list());
  };

  updateAutomation = async (req: Request, res: Response) => {
    ok(
      res,
      await automationService.update(req.user!.id, req.params.key as AutomationKey, req.body as UpdateAutomationBody),
    );
  };
}

export default new ManagerAiController();
