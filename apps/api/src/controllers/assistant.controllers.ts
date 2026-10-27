import type { AssistantRole } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import assistantService from '~/services/ai/assistant.service';

/** The route only lets assistant roles through, so the role is one the assistant serves. */
const actorOf = (req: Request) => ({ id: req.user!.id, role: req.user!.role as AssistantRole });

class AssistantController {
  chat = async (req: Request, res: Response) => {
    const result = await assistantService.chat(actorOf(req), req.body.messages);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  overview = async (req: Request, res: Response) => {
    const result = await assistantService.overview(actorOf(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };
}

export default new AssistantController();
