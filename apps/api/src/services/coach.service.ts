import { ERROR_CODE } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { toCoachPublicProfile } from '~/mappers/coach.mapper';
import coachRepository from '~/repositories/coach.repository';
import { ErrorWithStatus } from '~/rules/error';

class CoachService {
  getPublicProfile = async (id: string) => {
    const row = await coachRepository.findPublic(id);
    if (!row) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.NOT_FOUND,
        code: ERROR_CODE.NOT_FOUND,
        message: 'Không tìm thấy huấn luyện viên',
      });
    }
    return toCoachPublicProfile(row);
  };
}

export default new CoachService();
