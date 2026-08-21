const { getDb } = require('../../../lib/db');
const { checkAuth, unauthorized, json, error } = require('../../../lib/api');

export async function GET(request) {
  if (!checkAuth(request)) return unauthorized();
  try {
    const db = await getDb();
    const accounts = await db.listAccounts();
    const safe = accounts.map((a) => ({
      ...a,
      cookiesEncrypted: undefined,
      passwordEncrypted: undefined,
      proxyUsage: a.proxyUsage
        ? {
            ...a.proxyUsage,
            url: String(a.proxyUsage.url || '').replace(
              /\/\/([^:@/]+):([^@/]+)@/,
              '//$1:***@'
            ),
          }
        : undefined,
      proxyAssignment: a.proxyAssignment
        ? {
            ...a.proxyAssignment,
            url: String(a.proxyAssignment.url || '').replace(
              /\/\/([^:@/]+):([^@/]+)@/,
              '//$1:***@'
            ),
          }
        : undefined,
      hasCookies: db.accountHasCookies(a),
      hasCredentials: db.accountHasCredentials(a),
    }));
    return json({ accounts: safe });
  } catch (e) {
    return error(e.message, 500);
  }
}

export async function POST(request) {
  if (!checkAuth(request)) return unauthorized();
  try {
    const body = await request.json();
    const { name, cookies, enabled, notes, twitterUsername, password } = body;
    if (!name?.trim()) return error('name required');
    if (cookies !== undefined && !Array.isArray(cookies)) return error('cookies must be an array');
    const db = await getDb();
    const acc = await db.createAccount(name.trim(), {
      cookies,
      enabled,
      notes,
      twitterUsername,
      password,
    });
    return json({
      account: {
        ...acc,
        cookiesEncrypted: undefined,
        passwordEncrypted: undefined,
        hasCookies: db.accountHasCookies(acc),
        hasCredentials: db.accountHasCredentials(acc),
      },
    }, 201);
  } catch (e) {
    return error(e.message, 500);
  }
}
