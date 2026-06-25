const { getDb } = require('../../../../lib/db');
const { checkAuth, unauthorized, json, error } = require('../../../../lib/api');

export async function GET(request, { params }) {
  if (!checkAuth(request)) return unauthorized();
  try {
    const db = await getDb();
    const acc = await db.getAccount(params.name);
    if (!acc) return error('Not found', 404);
    return json({
      account: {
        ...acc,
        cookiesEncrypted: undefined,
        hasCookies: db.accountHasCookies(acc),
      },
    });
  } catch (e) {
    return error(e.message, 500);
  }
}

export async function PATCH(request, { params }) {
  if (!checkAuth(request)) return unauthorized();
  try {
    const body = await request.json();
    const validStatuses = ['alive', 'partial', 'suspended', 'dead', null];
    if (body.lastHealthStatus !== undefined) {
      const status = body.lastHealthStatus === '' ? null : body.lastHealthStatus;
      if (!validStatuses.includes(status)) {
        return error('lastHealthStatus must be alive, partial, suspended, dead, or null');
      }
      body.lastHealthStatus = status;
      if (body.lastHealthAt === undefined) {
        body.lastHealthAt = new Date().toISOString();
      }
    }
    const db = await getDb();
    const acc = await db.updateAccount(params.name, body);
    if (!acc) return error('Not found', 404);
    return json({ account: { ...acc, cookiesEncrypted: undefined, hasCookies: db.accountHasCookies(acc) } });
  } catch (e) {
    return error(e.message, 500);
  }
}

export async function DELETE(request, { params }) {
  if (!checkAuth(request)) return unauthorized();
  try {
    const db = await getDb();
    await db.deleteAccount(params.name);
    return json({ ok: true });
  } catch (e) {
    return error(e.message, 409);
  }
}
