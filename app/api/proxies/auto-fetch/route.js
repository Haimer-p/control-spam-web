const { getDb } = require('../../../../lib/db');
const { checkAuth, unauthorized, json, error } = require('../../../../lib/api');
const ProxyFetcher = require('../../../../lib/proxyFetcher');

export async function POST(request) {
  if (!checkAuth(request)) return unauthorized();
  try {
    const body = await request.json().catch(() => ({}));
    const requestedLimit = Number(body.limit ?? 300);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
      return error('limit must be a positive integer', 400);
    }
    const limit = Math.min(requestedLimit, 1000);
    const autoTest = body.autoTest !== false;
    const db = await getDb();

    if (autoTest) {
      const online = await db.isWorkerOnline();
      if (!online) return error('Worker offline - start worker before fetching proxies', 503);
      const runtime = await db.getBotRuntime();
      if (runtime?.running || runtime?.appealRunning) {
        return error('Worker is busy - stop the bot/appeal before fetching proxies', 409);
      }
    }

    // 1. Fetch proxies from public sources
    const fetched = await ProxyFetcher.fetchAllDetailed(limit);
    const urls = fetched.proxies;
    if (!urls.length) {
      return error('Không tìm thấy proxy nào từ các nguồn công khai', 502);
    }

    // 2. Save into DB
    const added = await db.addProxies(urls);

    // 3. Auto-trigger test if worker is online and requested
    let commandId = null;
    if (autoTest && added.length > 0) {
      const cmd = await db.createCommand({ action: 'test_new_proxies' });
      commandId = cmd._id;
    }

    return json({
      ok: true,
      found: urls.length,
      added: added.length,
      totalUnique: fetched.totalUnique,
      sources: fetched.sources,
      commandId,
    });
  } catch (e) {
    return error(e.message, 500);
  }
}
