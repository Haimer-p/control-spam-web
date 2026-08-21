const { getDb } = require('../../../../lib/db');
const { checkAuth, unauthorized, json, error } = require('../../../../lib/api');

// POST /api/proxies/test — gửi lệnh test_proxies tới worker
export async function POST(request) {
  if (!checkAuth(request)) return unauthorized();
  try {
    const db = await getDb();
    const online = await db.isWorkerOnline();
    if (!online) return error('Worker offline — start worker first', 503);

    const cmd = await db.createCommand({ action: 'test_proxies' });
    return json({ ok: true, commandId: cmd._id });
  } catch (e) {
    return error(e.message, 500);
  }
}
