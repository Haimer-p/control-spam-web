const { getDb } = require('../../../lib/db');
const { checkAuth, unauthorized, json, error } = require('../../../lib/api');
const { validateBatchSelection } = require('../../../lib/batch-profiles');

export async function POST(request) {
  if (!checkAuth(request)) return unauthorized();
  try {
    const body = await request.json();
    const {
      action,
      campaignId,
      campaignIds = [],
      configFiles = [],
      runProfile,
      accountNames,
      configFile,
      maxConcurrent,
    } = body;
    if (!action) return error('action required');

    const db = await getDb();

    const ids = [
      ...new Set([
        ...(Array.isArray(campaignIds) ? campaignIds : []),
        ...(campaignId ? [campaignId] : []),
      ].map(String).filter(Boolean)),
    ];
    const files = [
      ...new Set([
        ...(Array.isArray(configFiles) ? configFiles : []),
        ...(configFile ? [configFile] : []),
      ].map(String).filter(Boolean)),
    ];
    const names = Array.isArray(accountNames)
      ? accountNames.map((n) => String(n).trim()).filter(Boolean)
      : [];

    if (action === 'start') {
      const runtime = await db.getBotRuntime();
      if (runtime?.running) return error('Bot already running', 409);

      let batchPreview = null;
      if (ids.length || files.length) {
        batchPreview = await validateBatchSelection({ campaignIds: ids, configFiles: files });
        if (batchPreview.totalAccounts === 0 && !batchPreview.sources.some((s) => s.unverified)) {
          return error('No accounts to run after batch merge', 400);
        }
      } else if (!campaignId && !configFile) {
        return error('campaignIds, campaignId, configFiles, or configFile required for start');
      }

      const cmd = await db.createCommand({
        action,
        campaignId: campaignId || undefined,
        campaignIds: ids,
        configFiles: files,
        maxConcurrentOverride:
          maxConcurrent != null ? parseInt(String(maxConcurrent), 10) : undefined,
        runProfile: runProfile || 'vua',
        accountNames: names,
        configFile,
      });

      return json(
        {
          command: cmd,
          skippedDuplicates: batchPreview?.skippedDuplicates || [],
          totalAccounts: batchPreview?.totalAccounts,
        },
        201
      );
    }

    if (action === 'appeal') {
      const runtime = await db.getBotRuntime();
      if (runtime?.running) return error('Bot is running — stop it before appeal', 409);
      if (runtime?.appealRunning) return error('Appeal already in progress', 409);
      if (!names.length) return error('accountNames required for appeal', 400);
    }

    if (action === 'health_check') {
      const runtime = await db.getBotRuntime();
      if (runtime?.running) return error('Bot is running — stop it before health check', 409);
      if (runtime?.appealRunning) return error('Appeal in progress', 409);
    }

    if (action === 'login_account') {
      const runtime = await db.getBotRuntime();
      if (runtime?.running) return error('Bot is running — stop it before login', 409);
      if (runtime?.appealRunning) return error('Appeal in progress', 409);
      if (!names.length) return error('accountNames required for login_account', 400);
    }

    const cmd = await db.createCommand({
      action,
      campaignId: campaignId || undefined,
      campaignIds: ids,
      configFiles: files,
      maxConcurrentOverride:
        maxConcurrent != null ? parseInt(String(maxConcurrent), 10) : undefined,
      runProfile: runProfile || 'vua',
      accountNames: names,
      configFile,
    });

    return json({ command: cmd }, 201);
  } catch (e) {
    return error(e.message, 500);
  }
}

export async function GET(request) {
  if (!checkAuth(request)) return unauthorized();
  try {
    const db = await getDb();
    const commands = await db.listRecentCommands(20);
    return json({ commands });
  } catch (e) {
    return error(e.message, 500);
  }
}
