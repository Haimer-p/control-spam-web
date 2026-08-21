'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch, useApiPoll } from '@/lib/client';
import { Play, Square, Stethoscope, UserCheck, Search } from 'lucide-react';

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

type SkippedDuplicate = {
  account: string;
  keptSource: string;
  skippedSource: string;
};

function computeBatchPreview(
  campaigns: Campaign[],
  fileConfigs: FileConfig[],
  selectedCampaignIds: string[],
  selectedConfigFiles: string[]
) {
  const seen = new Map<string, string>();
  const skippedDuplicates: SkippedDuplicate[] = [];
  let rawTotal = 0;

  const processSource = (sourceName: string, names: string[]) => {
    for (const name of names) {
      rawTotal += 1;
      if (seen.has(name)) {
        skippedDuplicates.push({
          account: name,
          keptSource: seen.get(name)!,
          skippedSource: sourceName,
        });
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
    processSource(c.slug, names);
  }

  for (const path of selectedConfigFiles) {
    const f = fileConfigs.find((x) => x.path === path);
    if (!f) continue;
    processSource(f.name, f.accounts);
  }

  return { skippedDuplicates, effectiveTotal: seen.size, rawTotal };
}

function filterSort<T>(
  items: T[],
  query: string,
  getSearchText: (item: T) => string,
  getSortKey: (item: T) => string
) {
  const q = query.trim().toLowerCase();
  let list = [...items];
  if (q) {
    list = list.filter((item) => getSearchText(item).toLowerCase().includes(q));
  }
  list.sort((a, b) => getSortKey(a).localeCompare(getSortKey(b), undefined, { sensitivity: 'base' }));
  return list;
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
  const [maxConcurrentTouched, setMaxConcurrentTouched] = useState(false);
  const [msg, setMsg] = useState('');
  const [campaignSearch, setCampaignSearch] = useState('');
  const [configSearch, setConfigSearch] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [publishingEnabled, setPublishingEnabled] = useState(false);
  const [postTopic, setPostTopic] = useState('');
  const [postDelayMin, setPostDelayMin] = useState(1);
  const [postDelayMax, setPostDelayMax] = useState(5);
  const [postCooldownHours, setPostCooldownHours] = useState(12);
  const [maxThreadParts, setMaxThreadParts] = useState(4);
  const [threadDelayMin, setThreadDelayMin] = useState(20);
  const [threadDelayMax, setThreadDelayMax] = useState(45);
  const [commentTypingMin, setCommentTypingMin] = useState(55);
  const [commentTypingMax, setCommentTypingMax] = useState(140);
  const [postTypingMin, setPostTypingMin] = useState(70);
  const [postTypingMax, setPostTypingMax] = useState(170);

  const { data: runtime, reload } = useApiPoll<{
    online: boolean;
    runtime: {
      running?: boolean;
      stopping?: boolean;
      activeSources?: ActiveSource[];
      activeAccounts?: string[];
      runOptions?: { publishing?: { enabled?: boolean; maxThreadParts?: number } };
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

  const batchPreview = useMemo(
    () =>
      computeBatchPreview(
        campaigns,
        fileConfigs,
        selectedCampaignIds,
        selectedConfigFiles
      ),
    [campaigns, fileConfigs, selectedCampaignIds, selectedConfigFiles]
  );

  const { skippedDuplicates, effectiveTotal, rawTotal } = batchPreview;

  const filteredCampaigns = useMemo(
    () =>
      filterSort(
        campaigns,
        campaignSearch,
        (c) => `${c.symbol} ${c.slug}`,
        (c) => c.symbol || c.slug
      ),
    [campaigns, campaignSearch]
  );

  const filteredFileConfigs = useMemo(
    () =>
      filterSort(
        fileConfigs,
        configSearch,
        (f) => `${f.name} ${f.path}`,
        (f) => f.name
      ),
    [fileConfigs, configSearch]
  );

  const filteredAccounts = useMemo(
    () =>
      filterSort(
        accounts,
        accountSearch,
        (a) => a.name,
        (a) => a.name
      ),
    [accounts, accountSearch]
  );

  useEffect(() => {
    if (!filteredAccounts.length) return;
    setLoginAccountName((prev) =>
      filteredAccounts.some((a) => a.name === prev) ? prev : filteredAccounts[0].name
    );
  }, [filteredAccounts]);

  const totalAccounts = effectiveTotal;

  // Mặc định Max concurrent = số account được chọn, cho tới khi user tự chỉnh
  useEffect(() => {
    if (maxConcurrentTouched) return;
    if (effectiveTotal > 0) setMaxConcurrent(effectiveTotal);
  }, [effectiveTotal, maxConcurrentTouched]);

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
      const res = (await apiFetch('/api/commands', {
        method: 'POST',
        body: JSON.stringify({
          action,
          runProfile,
          ...payload,
        }),
      })) as { skippedDuplicates?: SkippedDuplicate[] };
      let text =
        action === 'stop'
          ? 'Đã gửi lệnh stop — bot sẽ dừng sau khi xong action hiện tại (có thể vài phút)'
          : action === 'login_account'
            ? 'Đã mở browser login. Browser sẽ giữ nguyên đến khi bạn bấm Stop hoặc tự đóng browser.'
            : `Đã gửi lệnh ${action} — worker sẽ xử lý trong vài giây`;
      if (res.skippedDuplicates?.length) {
        const skips = res.skippedDuplicates
          .map((d) => `${d.account}: giữ [${d.keptSource}], skip [${d.skippedSource}]`)
          .join('; ');
        text += `. Cảnh báo trùng account: ${skips}`;
      }
      setMsg(text);
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
    if (effectiveTotal === 0) {
      setMsg('Không có account nào để chạy');
      return;
    }
    send('start', {
      campaignIds: selectedCampaignIds,
      configFiles: selectedConfigFiles,
      maxConcurrent,
      runOptions: {
        publishing: {
          enabled: publishingEnabled,
          topic: postTopic,
          initialDelayMinutes: { min: postDelayMin, max: postDelayMax },
          cooldownHours: postCooldownHours,
          maxThreadParts,
          threadDelaySeconds: { min: threadDelayMin, max: threadDelayMax },
        },
        typing: {
          comment: { min: commentTypingMin, max: commentTypingMax },
          post: { min: postTypingMin, max: postTypingMax },
        },
      },
    });
  };

  const canStart =
    (selectedCampaignIds.length > 0 || selectedConfigFiles.length > 0) &&
    effectiveTotal > 0;

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
        {runtime?.runtime?.running && (
          <div className="text-xs text-surface-muted pt-1">
            AI posting: {runtime.runtime.runOptions?.publishing?.enabled ? 'Bật' : 'Tắt'}
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold">Chọn configs để chạy batch</h3>

        <div>
          <label className="label">Campaigns (DB)</label>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-muted pointer-events-none" />
            <input
              className="input pl-9 text-sm"
              placeholder="Tìm symbol, slug..."
              value={campaignSearch}
              onChange={(e) => setCampaignSearch(e.target.value)}
            />
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {filteredCampaigns.map((c) => (
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
            {!campaigns.length ? (
              <p className="text-sm text-surface-muted">Không có campaign</p>
            ) : !filteredCampaigns.length ? (
              <p className="text-sm text-surface-muted">Không khớp &quot;{campaignSearch}&quot;</p>
            ) : null}
          </div>
        </div>

        <div>
          <label className="label">File configs (legacy)</label>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-muted pointer-events-none" />
            <input
              className="input pl-9 text-sm"
              placeholder="Tìm tên file config..."
              value={configSearch}
              onChange={(e) => setConfigSearch(e.target.value)}
            />
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {filteredFileConfigs.map((f) => (
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
            {!fileConfigs.length ? (
              <p className="text-sm text-surface-muted">
                Không tìm thấy configs/*.json (chỉ có trên máy chạy worker)
              </p>
            ) : !filteredFileConfigs.length ? (
              <p className="text-sm text-surface-muted">Không khớp &quot;{configSearch}&quot;</p>
            ) : null}
          </div>
        </div>

        <p className="text-sm">
          Tổng: {selectedCampaignIds.length} campaign + {selectedConfigFiles.length} file ={' '}
          <strong>{totalAccounts}</strong> accounts sẽ chạy
          {skippedDuplicates.length > 0 && rawTotal > totalAccounts && (
            <span className="text-surface-muted">
              {' '}
              ({rawTotal - totalAccounts} trùng sẽ skip)
            </span>
          )}
        </p>

        {skippedDuplicates.length > 0 && (
          <p className="text-sm text-amber-400">
            Account trùng — ưu tiên config chọn trước:{' '}
            {skippedDuplicates
              .map((d) => `${d.account}: giữ [${d.keptSource}], skip [${d.skippedSource}]`)
              .join('; ')}
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
              onChange={(e) => {
                setMaxConcurrentTouched(true);
                setMaxConcurrent(Math.max(1, +e.target.value || 1));
              }}
            />
            <p className="text-xs text-surface-muted mt-1">
              {maxConcurrentTouched
                ? 'Đang dùng giá trị tự chỉnh'
                : 'Mặc định = số account được chọn'}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-surface-border p-4 space-y-4">
          <label className="flex items-center gap-2 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={publishingEnabled}
              onChange={(e) => setPublishingEnabled(e.target.checked)}
            />
            Tự đăng bài AI khi chạy bot
          </label>

          {publishingEnabled && (
            <div className="space-y-4">
              <div>
                <label className="label">Chủ đề / yêu cầu cho bài đăng</label>
                <textarea
                  className="input min-h-[90px]"
                  value={postTopic}
                  onChange={(e) => setPostTopic(e.target.value)}
                  placeholder="Ví dụ: phân tích ngắn về xu hướng memecoin; nếu để trống AI dùng campaign và keywords"
                />
              </div>

              <div className="form-grid-2">
                <div>
                  <label className="label">Đăng sau login (phút, min)</label>
                  <input className="input" type="number" min={0} max={120} value={postDelayMin}
                    onChange={(e) => setPostDelayMin(+e.target.value || 0)} />
                </div>
                <div>
                  <label className="label">Đăng sau login (phút, max)</label>
                  <input className="input" type="number" min={0} max={120} value={postDelayMax}
                    onChange={(e) => setPostDelayMax(+e.target.value || 0)} />
                </div>
                <div>
                  <label className="label">Cooldown giữa các lần đăng (giờ)</label>
                  <input className="input" type="number" min={1} max={168} value={postCooldownHours}
                    onChange={(e) => setPostCooldownHours(+e.target.value || 1)} />
                </div>
                <div>
                  <label className="label">Số phần thread tối đa</label>
                  <input className="input" type="number" min={1} max={8} value={maxThreadParts}
                    onChange={(e) => setMaxThreadParts(+e.target.value || 1)} />
                </div>
                <div>
                  <label className="label">Delay giữa phần thread (giây, min)</label>
                  <input className="input" type="number" min={5} max={300} value={threadDelayMin}
                    onChange={(e) => setThreadDelayMin(+e.target.value || 5)} />
                </div>
                <div>
                  <label className="label">Delay giữa phần thread (giây, max)</label>
                  <input className="input" type="number" min={5} max={300} value={threadDelayMax}
                    onChange={(e) => setThreadDelayMax(+e.target.value || 5)} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-surface-border p-4 space-y-3">
          <h4 className="font-medium">Tốc độ nhập chữ trong lần chạy này</h4>
          <div className="form-grid-2">
            <div>
              <label className="label">Comment min (ms/ký tự)</label>
              <input className="input" type="number" min={10} max={500} value={commentTypingMin}
                onChange={(e) => setCommentTypingMin(+e.target.value || 10)} />
            </div>
            <div>
              <label className="label">Comment max (ms/ký tự)</label>
              <input className="input" type="number" min={10} max={500} value={commentTypingMax}
                onChange={(e) => setCommentTypingMax(+e.target.value || 10)} />
            </div>
            <div>
              <label className="label">Post/thread min (ms/ký tự)</label>
              <input className="input" type="number" min={10} max={500} value={postTypingMin}
                onChange={(e) => setPostTypingMin(+e.target.value || 10)} />
            </div>
            <div>
              <label className="label">Post/thread max (ms/ký tự)</label>
              <input className="input" type="number" min={10} max={500} value={postTypingMax}
                onChange={(e) => setPostTypingMax(+e.target.value || 10)} />
            </div>
          </div>
          <p className="text-xs text-surface-muted">
            Worker thêm các khoảng nghỉ ngắn khi nhập. Cooldown và giới hạn thread vẫn được áp dụng để tránh hoạt động dồn dập.
          </p>
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
          <p className={`text-sm ${
            msg.includes('Error') || msg.includes('required') || msg.startsWith('Không')
              ? 'text-accent-red'
              : msg.includes('Cảnh báo')
                ? 'text-amber-400'
                : 'text-accent-green'
          }`}>
            {msg}
          </p>
        )}
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold">Login 1 account (giữ browser mở)</h3>
        <div>
          <label className="label">Account</label>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-muted pointer-events-none" />
            <input
              className="input pl-9 text-sm"
              placeholder="Tìm tên account..."
              value={accountSearch}
              onChange={(e) => setAccountSearch(e.target.value)}
            />
          </div>
          <select
            className="input"
            value={loginAccountName}
            onChange={(e) => setLoginAccountName(e.target.value)}
          >
            {filteredAccounts.map((a) => (
              <option key={a.name} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
          {accounts.length > 0 && !filteredAccounts.length && (
            <p className="text-xs text-surface-muted mt-1">Không khớp &quot;{accountSearch}&quot;</p>
          )}
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
