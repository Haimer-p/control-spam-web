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
        passwordEncrypted: undefined,
        hasCookies: db.accountHasCookies(acc),
        hasCredentials: db.accountHasCredentials(acc),
        twitterUsername: acc.twitterUsername || '',
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

    // Handle credential update
    if (body.twitterUsername !== undefined || body.password !== undefined) {
      if (body.twitterUsername !== undefined && typeof body.twitterUsername !== 'string') {
        return error('twitterUsername must be a string', 400);
      }
      if (body.password !== undefined && typeof body.password !== 'string') {
        return error('password must be a string', 400);
      }
      if (body.twitterUsername !== undefined) {
        body.twitterUsername = String(body.twitterUsername || '').trim();
      }
      // body.password will be encrypted in updateAccount
    }

    const db = await getDb();
    const requestedName = body.newName !== undefined ? String(body.newName).trim() : params.name;
    if (!requestedName) return error('newName cannot be empty', 400);
    if (requestedName !== params.name) {
      await db.renameAccount(params.name, requestedName);
    }
    delete body.newName;
    const acc = await db.updateAccount(requestedName, body);
    if (!acc) return error('Not found', 404);
    return json({
      account: {
        ...acc,
        cookiesEncrypted: undefined,
        passwordEncrypted: undefined,
        hasCookies: db.accountHasCookies(acc),
        hasCredentials: db.accountHasCredentials(acc),
        twitterUsername: acc.twitterUsername || '',
      },
    });
  } catch (e) {
    const status = e.code === 'ACCOUNT_EXISTS' || e.code === 'ACCOUNT_BUSY' ? 409 : 500;
    return error(e.message, status);
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
