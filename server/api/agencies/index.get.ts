import { SEED_AGENCIES, SEED_MEMBERS } from '../../data/seed';
export default defineEventHandler(() => ({ agencies: SEED_AGENCIES, members: SEED_MEMBERS }));
