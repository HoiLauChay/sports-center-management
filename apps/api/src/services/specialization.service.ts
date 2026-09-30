import { toSpecializationResponse } from '~/mappers/specialization.mapper';
import specializationRepository from '~/repositories/specialization.repository';

class SpecializationService {
  listForCoach = async (coachId: string) => {
    const rows = await specializationRepository.findAll(coachId);
    return rows.map(toSpecializationResponse);
  };

  listForManager = async () => {
    const rows = await specializationRepository.findAll();
    return rows.map(toSpecializationResponse);
  };
}

export default new SpecializationService();
