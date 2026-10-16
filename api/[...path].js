// Vercel function: every /api/* request. The logic lives in server/.
import { handle } from '../server/router.js';

export default handle;
