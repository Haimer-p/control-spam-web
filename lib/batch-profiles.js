const path = require('path');
const { getDb } = require('./db');
const { summarizeConfigFile } = require('./config-files');

function dedupeBatchSources(sources) {
  const seen = new Map();
  const skippedDuplicates = [];
  let rawTotal = 0;

  for (const src of sources) {
    if (src.unverified) continue;
    for (const acc of src.accounts) {
      rawTotal += 1;
      if (seen.has(acc)) {
        skippedDuplicates.push({
          account: acc,
          keptSource: seen.get(acc),
          skippedSource: src.name,
        });
      } else {
        seen.set(acc, src.name);
      }
    }
  }

  return {
    skippedDuplicates,
    effectiveTotal: seen.size,
    rawTotal,
  };
}

async function validateBatchSelection({ campaignIds = [], configFiles = [] }) {
  const ids = [...new Set((campaignIds || []).map(String).filter(Boolean))];
  const files = [...new Set((configFiles || []).map(String).filter(Boolean))];

  if (!ids.length && !files.length) {
    throw new Error('At least one campaign or config file required');
  }

  const db = await getDb();
  const sources = [];

  for (const id of ids) {
    const campaign = await db.getCampaign(id);
    if (!campaign) throw new Error(`Campaign not found: ${id}`);
    const accounts = (campaign.accounts || [])
      .filter((a) => a.name && a.enabled !== false)
      .map((a) => a.name);
    if (!accounts.length) throw new Error(`Campaign ${campaign.slug} has no enabled accounts`);
    sources.push({
      type: 'campaign',
      name: campaign.slug,
      campaignId: String(campaign._id),
      accountCount: accounts.length,
      accounts,
    });
  }

  for (const file of files) {
    const summary = summarizeConfigFile(file);
    if (!summary) {
      sources.push({
        type: 'file',
        name: path.basename(file),
        path: file,
        accountCount: 0,
        accounts: [],
        unverified: true,
      });
      continue;
    }
    if (!summary.accounts.length) throw new Error(`${summary.name} has no enabled accounts`);
    sources.push(summary);
  }

  const { skippedDuplicates, effectiveTotal, rawTotal } = dedupeBatchSources(sources);

  if (effectiveTotal === 0 && sources.some((s) => !s.unverified)) {
    throw new Error('No accounts to run after batch merge');
  }

  return {
    sources,
    totalAccounts: effectiveTotal,
    rawTotal,
    skippedDuplicates,
    suggestedMaxConcurrent: Math.min(3, Math.max(1, effectiveTotal)),
  };
}

module.exports = {
  validateBatchSelection,
  dedupeBatchSources,
};
