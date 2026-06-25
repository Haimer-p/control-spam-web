'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, useApiPoll } from '@/lib/client';
import { Pencil, Trash2, Plus, Gavel } from 'lucide-react';

type Account = {
  name: string;
  enabled: boolean;
  hasCookies: boolean;
  lastHealthStatus?: string;
  profile?: { username?: string };
};

function statusBadge(s?: string) {
  if (!s) return <span className="badge bg-gray-800 text-gray-400">unknown</span>;
  return <span className={`badge badge-${s}`}>{s}</span>;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [appealing, setAppealing] = useState<string | null>(null);

  const { data: runtimeData } = useApiPoll<{
    online: boolean;
    runtime?: {
      appealRunning?: boolean;
      appealWaitingCaptcha?: boolean;
      appealCurrentAccount?: string;
    };
  }>('/api/runtime', 5000);

  const load = async () => {
    const data = await apiFetch('/api/accounts');
    setAccounts(data.accounts || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const remove = async (name: string) => {
    const confirm = prompt(`Gõ tên account để xóa: ${name}`);
    if (confirm !== name) return;
    await apiFetch(`/api/accounts/${encodeURIComponent(name)}`, { method: 'DELETE' });
    load();
  };

  const appeal = async (name: string) => {
    if (
      !window.confirm(
        `Appeal account "${name}"?\n\nWorker local sẽ mở Chrome, điền form appeal tự động. Bạn có thể cần giải captcha thủ công trong browser.`
      )
    ) {
      return;
    }
    setAppealing(name);
    setMsg('');
    try {
      await apiFetch('/api/commands', {
        method: 'POST',
        body: JSON.stringify({ action: 'appeal', accountNames: [name] }),
      });
      setMsg(
        `Đã gửi lệnh appeal cho ${name} — kiểm tra browser trên máy chạy worker (npm run worker)`
      );
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setAppealing(null);
    }
  };

  const captchaDone = async () => {
    try {
      await apiFetch('/api/commands', {
        method: 'POST',
        body: JSON.stringify({ action: 'appeal_captcha_done' }),
      });
      setMsg('Đã báo worker: captcha xong');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  };

  const runtime = runtimeData?.runtime;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="text-xl sm:text-2xl font-bold">Accounts</h1>
        <div className="page-actions">
          <Link href="/health" className="btn btn-ghost w-full sm:w-auto justify-center">
            Health Check
          </Link>
          <Link href="/accounts/new" className="btn btn-primary w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Thêm account</span>
            <span className="sm:hidden">Thêm</span>
          </Link>
        </div>
      </div>

      {!runtimeData?.online && (
        <p className="text-sm text-amber-400">
          Worker offline — chạy <code className="text-xs">npm run worker</code> trên máy local để appeal.
        </p>
      )}

      {runtime?.appealRunning && (
        <div className="card space-y-2 border-amber-500/40">
          <p className="text-sm">
            Appeal đang chạy
            {runtime.appealCurrentAccount ? `: ${runtime.appealCurrentAccount}` : ''}
          </p>
          {runtime.appealWaitingCaptcha && (
            <button type="button" className="btn btn-primary w-full sm:w-auto justify-center" onClick={captchaDone}>
              Đã xong captcha
            </button>
          )}
        </div>
      )}

      {msg && (
        <p
          className={`text-sm ${
            msg.includes('Error') || msg.includes('required') || msg.includes('running')
              ? 'text-accent-red'
              : 'text-accent-green'
          }`}
        >
          {msg}
        </p>
      )}

      {loading ? (
        <p className="text-surface-muted">Đang tải...</p>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="grid gap-3 md:hidden">
            {accounts.map((a) => (
              <div key={a.name} className="card space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-surface-muted">@{a.profile?.username || '?'}</div>
                  </div>
                  {statusBadge(a.lastHealthStatus)}
                </div>
                <div className="flex gap-3 text-xs text-surface-muted">
                  <span>Cookies: {a.hasCookies ? '✓' : '✗'}</span>
                  <span>Enabled: {a.enabled ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link
                    href={`/accounts/${encodeURIComponent(a.name)}/edit`}
                    className="btn btn-ghost flex-1 justify-center py-2 min-w-[80px]"
                  >
                    <Pencil className="w-4 h-4" /> Sửa
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost flex-1 justify-center py-2 min-w-[80px]"
                    disabled={appealing === a.name || !!runtime?.appealRunning}
                    onClick={() => appeal(a.name)}
                  >
                    <Gavel className="w-4 h-4" />
                    {appealing === a.name ? '...' : 'Appeal'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger py-2 px-3"
                    onClick={() => remove(a.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="card table-wrap hidden md:block">
            <table className="table-base">
              <thead>
                <tr className="text-surface-muted border-b border-surface-border">
                  <th className="text-left py-2 pr-4">Name</th>
                  <th className="text-left py-2 pr-4">Twitter</th>
                  <th className="text-left py-2 pr-4">Health</th>
                  <th className="text-left py-2 pr-4">Cookies</th>
                  <th className="text-left py-2 pr-4">Enabled</th>
                  <th className="text-right py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.name} className="border-b border-surface-border/50">
                    <td className="py-3 pr-4 font-medium">{a.name}</td>
                    <td className="py-3 pr-4 text-surface-muted">@{a.profile?.username || '?'}</td>
                    <td className="py-3 pr-4">{statusBadge(a.lastHealthStatus)}</td>
                    <td className="py-3 pr-4">{a.hasCookies ? '✓' : '✗'}</td>
                    <td className="py-3 pr-4">{a.enabled ? 'Yes' : 'No'}</td>
                    <td className="py-3 text-right space-x-1">
                      <Link
                        href={`/accounts/${encodeURIComponent(a.name)}/edit`}
                        className="btn btn-ghost py-1 px-2 inline-flex"
                        title="Sửa"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        className="btn btn-ghost py-1 px-2 inline-flex"
                        title="Appeal"
                        disabled={appealing === a.name || !!runtime?.appealRunning}
                        onClick={() => appeal(a.name)}
                      >
                        <Gavel className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger py-1 px-2"
                        title="Xóa"
                        onClick={() => remove(a.name)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
