const { getDb } = require('../../../lib/db');
const { checkAuth, unauthorized, json, error } = require('../../../lib/api');

export async function GET(request) {
  if (!checkAuth(request)) return unauthorized();
  try {
    const db = await getDb();
    const proxies = await db.listProxies();
    return json({ proxies });
  } catch (e) {
    return error(e.message, 500);
  }
}

export async function POST(request) {
  if (!checkAuth(request)) return unauthorized();
  try {
    const body = await request.json();
    // Support bulk: { urls: [...] } or single { url: "..." }
    let urls = [];
    if (Array.isArray(body.urls)) {
      urls = body.urls;
    } else if (body.url) {
      urls = [body.url];
    } else if (typeof body === 'string') {
      urls = body.split('\n');
    }
    if (!urls.length) return error('urls or url required');

    const db = await getDb();
    const added = await db.addProxies(urls);
    return json({ added, count: added.length }, 201);
  } catch (e) {
    return error(e.message, 500);
  }
}

const Database = require('../../../lib/database');

export async function DELETE(request) {
  if (!checkAuth(request)) return unauthorized();
  try {
    const body = await request.json().catch(() => ({}));
    const db = await getDb();

    if (body.allDead) {
      if (typeof db.deleteDeadProxies === 'function') {
        const res = await db.deleteDeadProxies();
        return json({ ok: true, deletedCount: res.deletedCount });
      }
      const res = await Database.models.Proxy.deleteMany({ status: 'dead' });
      return json({ ok: true, deletedCount: res.deletedCount });
    }

    const ids = body.ids || (body.id ? [body.id] : []);
    if (!ids.length) return error('ids required');

    if (typeof db.deleteProxies === 'function') {
      await db.deleteProxies(ids);
    } else {
      await Database.models.Proxy.deleteMany({ _id: { $in: ids } });
    }

    return json({ ok: true, count: ids.length });
  } catch (e) {
    return error(e.message, 500);
  }
}
