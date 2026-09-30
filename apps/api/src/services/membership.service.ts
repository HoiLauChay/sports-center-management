import { toMembershipResponse } from '~/mappers/membership.mapper';
import membershipRepository from '~/repositories/membership.repository';

class MembershipService {
  list = async (isManager: boolean) => {
    const rows = await membershipRepository.findAll(isManager);
    return rows.map(toMembershipResponse);
  };
}

export default new MembershipService();
