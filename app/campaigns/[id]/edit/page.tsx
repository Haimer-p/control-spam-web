'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client';

type CampaignAccount = {
  name: string;
  enabled?: boolean;
  keywords?: string[];
  delays?: Record<string, unknown>;
  interactions?: Record<string, unknown>;
};

type DbAccount = { name: string; enabled?: boolean };

export default function EditCampaignPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [campaign, setCampaign] = useState<Record<string, unknown> | null>(null);
  const [allAccounts, setAllAccounts] = useState<DbAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [keywordsText, setKeywordsText] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    apiFetch(`/api/campaigns/${id}`).then((d) => {
      const c = d.campaign;
      setCampaign(c);
      const accs = (c?.accounts || []) as CampaignAccount[];
      setSelectedAccounts(new Set(accs.map((a) => a.name)));
      const first = accs[0];
      setKeywordsText((first?.keywords || []).join('\n'));
    });
    apiFetch('/api/accounts').then((d) => {
      setAllAccounts((d.accounts || []).filter((a: DbAccount) => a.enabled !== false));
    });
  }, [id]);

  const toggleAccount = (name: string) => {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const save = async () => {
    if (!campaign) return;
    if (!selectedAccounts.size) {
      setErr('Chọn ít nhất 1 account');
      return;
    }
    try {
      const keywords = keywordsText.split('\n').map((k) => k.trim()).filter(Boolean);
      const existing = (campaign.accounts as CampaignAccount[]) || [];
      const existingOrder = existing.map((a) => a.name).filter((n) => selectedAccounts.has(n));
      const added = [...selectedAccounts].filter((n) => !existingOrder.includes(n));
      const ordered = [...existingOrder, ...added];

      const accounts = ordered.map((name, i) => {
        const prev = existing.find((a) => a.name === name);
        const base = prev || { name, enabled: true, keywords: [] as string[] };
        if (i === 0) return { ...base, keywords };
        return base;
      });

      await apiFetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ accounts, status: 'active' }),
      });
      router.push('/campaigns');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error');
    }
  };

  if (!campaign) return <p className="text-surface-muted">Loading...</p>;

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold break-words">
        Edit: ${String(campaign.symbol)} — {String(campaign.name)}
      </h1>
      <div className="card space-y-3 text-sm">
        <div className="break-words">
          <span className="text-surface-muted">Dex: </span>
          <a
            href={String(campaign.dexUrl)}
            className="text-accent break-all"
            target="_blank"
            rel="noreferrer"
          >
            {String(campaign.dexUrl)}
          </a>
        </div>
      </div>

      <div className="card space-y-3">
        <label className="label">Chọn accounts cho campaign này</label>
        <div className="flex flex-wrap gap-2">
          {allAccounts.map((a) => (
            <label
              key={a.name}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer max-w-full ${
                selectedAccounts.has(a.name)
                  ? 'border-accent bg-accent/10'
                  : 'border-surface-border'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedAccounts.has(a.name)}
                onChange={() => toggleAccount(a.name)}
              />
              <span className="truncate max-w-[140px] sm:max-w-none">{a.name}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-surface-muted">
          Đã chọn {selectedAccounts.size} account. Mỗi account chỉ nên thuộc 1 config khi chạy batch.
        </p>
      </div>

      <div>
        <label className="label">Keywords (account đầu tiên — mỗi dòng 1 keyword)</label>
        <textarea
          className="input min-h-[260px] sm:min-h-[300px] font-mono text-xs"
          value={keywordsText}
          onChange={(e) => setKeywordsText(e.target.value)}
        />
      </div>
      {err && <p className="text-accent-red text-sm">{err}</p>}
      <button className="btn btn-primary w-full sm:w-auto justify-center" onClick={save}>
        Lưu & Activate
      </button>
    </div>
  );
}
