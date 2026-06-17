const { checkAuth, unauthorized, json, error } = require('../../../lib/api');
const { listConfigSummaries } = require('../../../lib/config-files');

export async function GET(request) {
  if (!checkAuth(request)) return unauthorized();
  try {
    const configs = listConfigSummaries();
    return json({ configs });
  } catch (e) {
    return error(e.message, 500);
  }
}
