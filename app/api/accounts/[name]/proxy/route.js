const { getDb } = require('../../../../../lib/db');
const { checkAuth, unauthorized, json, error } = require('../../../../../lib/api');

function maskProxyUrl(url) {
  return String(url || '').replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@');
}

export async function POST(request, { params }) {
  if (!checkAuth(request)) return unauthorized();
  try {
    const db = await getDb();
    const proxy = await db.rotateAccountProxy(params.name);
    return json({
      ok: true,
      proxy: {
        id: proxy._id,
        url: maskProxyUrl(proxy.url),
        status: proxy.status,
      },
    });
  } catch (e) {
    const status = ['ACCOUNT_PROXY_IN_USE', 'NO_AVAILABLE_PROXY'].includes(e.code)
      ? 409
      : e.message === 'Account not found'
        ? 404
        : 500;
    return error(e.message, status);
  }
}
