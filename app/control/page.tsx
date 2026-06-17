'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch, useApiPoll } from '@/lib/client';
import { Play, Square, Stethoscope, UserCheck } from 'lucide-react';

type Campaign = {
  _id: string;
  slug: string;
  symbol: string;
  status: string;
  accounts?: { name: string; enabled?: boolean }[];
};

type FileConfig = {
  name: string;
  path: string;
  accountCount: number;
  accounts: string[];
};

type Account = { name: string; enabled?: boolean };

type ActiveSource = { type: string; name: string; accountCount?: number };

function findDuplicateAccounts(
  campaigns: Campaign[],
  fileConfigs: FileConfig[],
  selectedCampaignIds: string[],
  selectedConfigFiles: string[]
) {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];

  const addAccounts = (sourceName: string, names: string[]) => {
    for (const name of names) {
      if (seen.has(name)) {
        duplicates.push(`${name} (${seen.get(name)} + ${sourceName})`);
      } else {
        seen.set(name, sourceName);
      }
    }
  };

  for (const id of selectedCampaignIds) {
    const c = campaigns.find((x) => x._id === id);
    if (!c) continue;
    const names = (c.accounts || [])
      .filter((a) => a.enabled !== false)
      .map((a) => a.name);
    addAccounts(c.slug, names);
  }

  for (const path of selectedConfigFiles) {
    const f = fileConfigs.find((x) => x.path === path);
    if (!f) continue;
    addAccounts(f.name, f.accounts);
  }

  return [...new Set(duplicates)];
}

export default function ControlPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [fileConfigs, setFileConfigs] = useState<FileConfig[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [selectedConfigFiles, setSelectedConfigFiles] = useState<string[]>([]);
  const [loginAccountName, setLoginAccountName] = useState('');
  const [runProfile, setRunProfile] = useState('vua');
  const [maxConcurrent, setMaxConcurrent] = useState(2);
  const [msg, setMsg] = useState('');

  const { data: runtime, reload } = useApiPoll<{
    online: boolean;
    runtime: {
      running?: boolean;
      stopping?: boolean;
      activeSources?: ActiveSource[];
      activeAccounts?: string[];
    };
    commands: { action: string; status: string; createdAt: string }[];
  }>('/api/runtime', 5000);

  useEffect(() => {
    apiFetch('/api/campaigns')
      .then((d) => {
        const list = (d.campaigns || []).filter((c: Campaign) => c.status !== 'archived');
        setCampaigns(list);
      })
      .catch(() => setCampaigns([]));

    apiFetch('/api/configs')
      .then((d) => setFileConfigs(d.configs || []))
      .catch(() => setFileConfigs([]));

    apiFetch('/api/accounts')
      .then((d) => {
        const list = (d.accounts || []).filter((a: Account) => a.enabled !== false);
        setAccounts(list);
        if (list[0]) setLoginAccountName(list[0].name);
      })
      .catch(() => setAccounts([]));
  }, []);

  const duplicates = useMemo(
    () => findDuplicateAccounts(campaigns, fileConfigs, selectedCampaignIds, selectedConfigFiles),
    [campaigns, fileConfigs, selectedCampaignIds, selectedConfigFiles]
  );

  const totalAccounts = useMemo(() => {
    let n = 0;
    for (const id of selectedCampaignIds) {
      const c = campaigns.find((x) => x._id === id);
      if (c) {
        n += (c.accounts || []).filter((a) => a.enabled !== false).length;
      }
    }
    for (const path of selectedConfigFiles) {
      const f = fileConfigs.find((x) => x.path === path);
      if (f) n += f.accountCount;
    }
    return n;
  }, [campaigns, fileConfigs, selectedCampaignIds, selectedConfigFiles]);

  const toggleCampaign = (id: string) => {
    setSelectedCampaignIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleConfigFile = (path: string) => {
    setSelectedConfigFiles((prev) =>
      prev.includes(path) ? prev.filter((x) => x !== path) : [...prev, path]
    );
  };

  const send = async (action: string, payload: Record<string, unknown> = {}) => {
    setMsg('');
    try {
      await apiFetch('/api/commands', {
        method: 'POST',
        body: JSON.stringify({
          action,
          runProfile,
          ...payload,
        }),
      });
      setMsg(
        action === 'stop'
          ? 'Đã gửi lệnh stop — bot sẽ dừng sau khi xong action hiện tại (có thể vài phút)'
          : action === 'login_account'
            ? 'Đã mở browser login. Browser sẽ giữ nguyên đến khi bạn bấm Stop hoặc tự đóng browser.'
            : `Đã gửi lệnh ${action} — worker sẽ xử lý trong vài giây`
      );
      reload();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  };

  const startBatch = () => {
    if (!selectedCampaignIds.length && !selectedConfigFiles.length) {
      setMsg('Chọn ít nhất 1 campaign hoặc file config');
      return;
    }
    if (duplicates.length) {
      setMsg(`Trùng account: ${duplicates.join(', ')}`);
      return;
    }
    send('start', {
      campaignIds: selectedCampaignIds,
      configFiles: selectedConfigFiles,
      maxConcurrent,
    });
  };

  const canStart =
    (selectedCampaignIds.length > 0 || selectedConfigFiles.length > 0) &&
    duplicates.length === 0 &&
    totalAccounts > 0;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">Bot Control</h1>

      <div className="card space-y-2">
        <div className="flex justify-between text-sm">
          <span>Worker</span>
          <span className={runtime?.online ? 'text-green-400' : 'text-gray-500'}>
            {runtime?.online ? 'Online' : 'Offline — chạy npm run worker trên máy local'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Bot running</span>
          <span>
            {runtime?.runtime?.stopping
              ? 'Đang dừng...'
              : runtime?.runtime?.running
                ? 'Yes'
                : 'No'}
          </span>
        </div>
        {runtime?.runtime?.activeSources?.length ? (
          <div className="text-xs text-surface-muted pt-1">
            Sources:{' '}
            {runtime.runtime.activeSources.map((s) => s.name).join(', ')}
            {runtime.runtime.activeAccounts?.length
              ? ` (${runtime.runtime.activeAccounts.length} accounts)`
              : ''}
          </div>
        ) : null}
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold">Chọn configs để chạy batch</h3>

        <div>
          <label className="label">Campaigns (DB)</label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {campaigns.map((c) => (
              <label
                key={c._id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ${
                  selectedCampaignIds.includes(c._id)
                    ? 'border-accent bg-accent/10'
                    : 'border-surface-border'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedCampaignIds.includes(c._id)}
                  onChange={() => toggleCampaign(c._id)}
                />
                <span className="font-mono">${c.symbol}</span>
                <span className="text-surface-muted truncate">{c.slug}</span>
                <span className="text-xs text-surface-muted ml-auto shrink-0">
                  {(c.accounts || []).filter((a) => a.enabled !== false).length} acc
                </span>
              </label>
            ))}
            {!campaigns.length && (
              <p className="text-sm text-surface-muted">Không có campaign</p>
            )}
          </div>
        </div>

        <div>
          <label className="label">File configs (legacy)</label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {fileConfigs.map((f) => (
              <label
                key={f.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ${
                  selectedConfigFiles.includes(f.path)
                    ? 'border-accent bg-accent/10'
                    : 'border-surface-border'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedConfigFiles.includes(f.path)}
                  onChange={() => toggleConfigFile(f.path)}
                />
                <span className="truncate">{f.name}</span>
                <span className="text-xs text-surface-muted ml-auto shrink-0">
                  {f.accountCount} acc
                </span>
              </label>
            ))}
            {!fileConfigs.length && (
              <p className="text-sm text-surface-muted">
                Không tìm thấy configs/*.json (chỉ có trên máy chạy worker)
              </p>
            )}
          </div>
        </div>

        <p className="text-sm">
          Tổng: {selectedCampaignIds.length} campaign + {selectedConfigFiles.length} file ={' '}
          <strong>{totalAccounts}</strong> accounts
        </p>

        {duplicates.length > 0 && (
          <p className="text-sm text-accent-red">
            Trùng account: {duplicates.join(', ')}
          </p>
        )}

        <div className="form-grid-2">
          <div>
            <label className="label">Run profile</label>
            <select className="input" value={runProfile} onChange={(e) => setRunProfile(e.target.value)}>
              <option value="yeu">Yếu (chậm)</option>
              <option value="vua">Vừa</option>
              <option value="manh">Mạnh (nhanh)</option>
            </select>
          </div>
          <div>
            <label className="label">Max concurrent browsers</label>
            <input
              className="input"
              type="number"
              min={1}
              max={Math.max(1, totalAccounts || 6)}
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(Math.max(1, +e.target.value || 2))}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            className="btn btn-primary w-full sm:w-auto justify-center"
            disabled={!canStart}
            onClick={startBatch}
          >
            <Play className="w-4 h-4" /> Start batch
          </button>
          <button className="btn btn-danger w-full sm:w-auto justify-center" onClick={() => send('stop')}>
            <Square className="w-4 h-4" /> Stop
          </button>
          <button className="btn btn-ghost w-full sm:w-auto justify-center" onClick={() => send('health_check')}>
            <Stethoscope className="w-4 h-4" /> Health Check
          </button>
        </div>
        {msg && (
          <p className={`text-sm ${msg.startsWith('Trùng') || msg.includes('Error') || msg.includes('required') ? 'text-accent-red' : 'text-accent-green'}`}>
            {msg}
          </p>
        )}
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold">Login 1 account (giữ browser mở)</h3>
        <div>
          <label className="label">Account</label>
          <select
            className="input"
            value={loginAccountName}
            onChange={(e) => setLoginAccountName(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.name} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <button
          className="btn btn-ghost w-full sm:w-auto justify-center"
          disabled={!loginAccountName}
          onClick={() => send('login_account', { accountNames: [loginAccountName] })}
        >
          <UserCheck className="w-4 h-4" /> Login Account
        </button>
        <p className="text-xs text-surface-muted">
          Sau khi login thành công, browser sẽ không tự đóng. Bấm Stop để đóng hoặc tự đóng cửa sổ browser.
        </p>
      </div>

      {runtime?.commands?.length ? (
        <div className="card">
          <h3 className="font-semibold mb-2 text-sm">Lệnh gần đây</h3>
          <ul className="text-xs space-y-1 text-surface-muted">
            {runtime.commands.slice(0, 5).map((c, i) => (
              <li key={i}>
                {c.action} — {c.status} — {new Date(c.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
