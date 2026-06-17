const fs = require('fs');
const path = require('path');

function getConfigsRoot() {
  if (process.env.CONFIGS_DIR) return process.env.CONFIGS_DIR;
  const candidates = [
    path.join(process.cwd(), 'configs'),
    path.join(process.cwd(), '..', 'configs'),
    path.join(process.cwd(), '..', '..', 'configs'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}

function resolveConfigPath(configFile) {
  if (!configFile) return null;
  if (path.isAbsolute(configFile)) return configFile;
  const normalized = configFile.replace(/\\/g, '/');
  const root = getConfigsRoot();
  if (normalized.startsWith('configs/')) {
    return path.join(path.dirname(root), normalized);
  }
  if (normalized.endsWith('.json')) {
    return path.join(root, path.basename(normalized));
  }
  return path.join(root, `${normalized}.json`);
}

function listConfigFiles() {
  const root = getConfigsRoot();
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(root, f));
}

function summarizeConfigFile(configFile) {
  const configPath = resolveConfigPath(configFile);
  if (!configPath || !fs.existsSync(configPath)) return null;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return null;
  }
  const accounts = (raw.accounts || [])
    .filter((a) => a.name && a.enabled !== false)
    .map((a) => a.name);
  const rel = path.relative(path.dirname(getConfigsRoot()), configPath).replace(/\\/g, '/');
  const displayPath = rel.startsWith('configs/') ? rel : `configs/${path.basename(configPath)}`;
  return {
    type: 'file',
    name: path.basename(configPath),
    path: displayPath,
    accountCount: accounts.length,
    accounts,
  };
}

function listConfigSummaries() {
  return listConfigFiles()
    .map((abs) => summarizeConfigFile(`configs/${path.basename(abs)}`))
    .filter(Boolean);
}

module.exports = {
  listConfigSummaries,
  summarizeConfigFile,
  resolveConfigPath,
};
