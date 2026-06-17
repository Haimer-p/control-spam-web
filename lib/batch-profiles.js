const { getDb } = require('./db');
const { listConfigSummaries, summarizeConfigFile } = require('./config-files');

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

  const verified = sources.filter((s) => !s.unverified);

  const seen = new Map();
  const duplicates = [];
  for (const src of verified) {
    for (const acc of src.accounts) {
      if (seen.has(acc)) {
        duplicates.push({ account: acc, sources: [seen.get(acc), src.name] });
      } else {
        seen.set(acc, src.name);
      }
    }
  }

  if (duplicates.length) {
    const detail = duplicates.map((d) => `${d.account} (${d.sources.join(' + ')})`).join(', ');
    throw new Error(`Duplicate accounts across configs: ${detail}`);
  }

  const totalAccounts = sources.reduce((n, s) => n + s.accountCount, 0);

  return {
    sources,
    totalAccounts,
    suggestedMaxConcurrent: Math.min(3, totalAccounts),
  };
}

module.exports = {
  validateBatchSelection,
};
