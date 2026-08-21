const { checkAuth, unauthorized, json } = require('../../../lib/api');

export async function GET(request) {
  if (!checkAuth(request)) return unauthorized();
  return json({ ok: true });
}
