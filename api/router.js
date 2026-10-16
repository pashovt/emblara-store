// Vercel function for every /api/* request (see the rewrite in vercel.json).
// The logic lives in server/.
import { handle } from '../server/router.js';

export default handle;
