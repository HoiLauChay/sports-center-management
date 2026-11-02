import { ERROR_CODE, type AssistantRole, type AssistantStreamEvent } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ErrorWithStatus } from '~/rules/error';
import { ResponseClient } from '~/rules/response';
import assistantService from '~/services/ai/assistant.service';

/** The route only lets assistant roles through, so the role is one the assistant serves. */
const actorOf = (req: Request) => ({ id: req.user!.id, role: req.user!.role as AssistantRole });

class AssistantController {
  chat = async (req: Request, res: Response) => {
    const { messages, conversationId } = req.body;
    const result = await assistantService.chat(actorOf(req), messages, { conversationId });
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  /**
   * The same answer, with what the assistant is looking up sent as it happens. The stream opens on the first event,
   * so anything refused before that (no quota left, say) is still an ordinary JSON error.
   */
  chatStream = async (req: Request, res: Response) => {
    const send = (event: AssistantStreamEvent) => {
      if (!res.headersSent) {
        res.writeHead(HTTP_STATUS.OK, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        });
      }
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const { messages, conversationId } = req.body;
      const result = await assistantService.chat(actorOf(req), messages, {
        conversationId,
        onStatus: (text) => send({ type: 'status', text }),
      });
      send({ type: 'done', result });
    } catch (err) {
      if (!res.headersSent) throw err;
      if (!(err instanceof ErrorWithStatus)) console.error('Assistant stream failed:', err);
      send(
        err instanceof ErrorWithStatus
          ? { type: 'error', code: err.code, message: err.message }
          : {
              type: 'error',
              code: ERROR_CODE.UPSTREAM_UNAVAILABLE,
              message: 'Trợ lý đang gặp sự cố, vui lòng thử lại',
            },
      );
    }
    res.end();
  };

  quota = async (req: Request, res: Response) => {
    const result = await assistantService.quota(actorOf(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  overview = async (req: Request, res: Response) => {
    const result = await assistantService.overview(actorOf(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  /** Forgets what the assistant remembered for a chat the person deleted. */
  forget = async (req: Request, res: Response) => {
    await assistantService.forget(req.user!.id, req.params.conversationId as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công' }));
  };
}

export default new AssistantController();
