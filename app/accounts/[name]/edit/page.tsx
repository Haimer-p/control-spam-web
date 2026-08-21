'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client';

type HealthStatus = 'alive' | 'partial' | 'suspended' | 'dead' | '';

const HEALTH_OPTIONS: { value: HealthStatus; label: string; hint: string }[] = [
  { value: 'alive', label: 'Alive', hint: 'Hoạt động bình thường' },
  { value: 'partial', label: 'Partial', hint: 'Một phần chức năng lỗi' },
  { value: 'suspended', label: 'Suspended', hint: 'Bị suspend / cần appeal' },
  { value: 'dead', label: 'Dead', hint: 'Không dùng được' },
  { value: '', label: 'Unknown', hint: 'Chưa xác định' },
];

function statusBadgeClass(status: HealthStatus) {
  if (!status) return 'bg-gray-800 text-gray-400';
  return `badge-${status}`;
}

export default function EditAccountPage() {
  const params = useParams();
  const name = decodeURIComponent(params.name as string);
  const router = useRouter();
  const [accountName, setAccountName] = useState(name);
  const [enabled, setEnabled] = useState(true);
  const [notes, setNotes] = useState('');
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('');
  const [lastHealthAt, setLastHealthAt] = useState<string | null>(null);
  const [cookiesJson, setCookiesJson] = useState('');
  const [twitterUsername, setTwitterUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [clearPassword, setClearPassword] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [credSaved, setCredSaved] = useState('');

  useEffect(() => {
    apiFetch(`/api/accounts/${encodeURIComponent(name)}`).then((d) => {
      const acc = d.account;
      setAccountName(acc.name || name);
      setEnabled(acc.enabled !== false);
      setNotes(acc.notes || '');
      setHealthStatus((acc.lastHealthStatus as HealthStatus) || '');
      setLastHealthAt(acc.lastHealthAt || null);
      setTwitterUsername(acc.twitterUsername || '');
      setHasCredentials(!!acc.hasCredentials);
    });
  }, [name]);

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      const body: Record<string, unknown> = {
        newName: accountName.trim(),
        enabled,
        notes,
        lastHealthStatus: healthStatus || null,
        twitterUsername: twitterUsername.trim(),
      };
      if (clearPassword) body.password = '';
      else if (newPassword) body.password = newPassword;
      if (cookiesJson.trim()) body.cookies = JSON.parse(cookiesJson);
      const res = await apiFetch(`/api/accounts/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setLastHealthAt(res.account?.lastHealthAt || null);
      setHasCredentials(!!res.account?.hasCredentials);
      setNewPassword('');
      setClearPassword(false);
      router.push('/accounts');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const setStatusQuick = async (status: HealthStatus) => {
    setHealthStatus(status);
    setSaving(true);
    setErr('');
    try {
      const res = await apiFetch(`/api/accounts/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        body: JSON.stringify({ lastHealthStatus: status || null }),
      });
      setLastHealthAt(res.account?.lastHealthAt || null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold break-words">Sửa: {name}</h1>

      <div className="card space-y-2">
        <label className="label">Tên account nội bộ</label>
        <input
          className="input"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          maxLength={100}
          autoComplete="off"
        />
        <p className="text-xs text-surface-muted">
          Đổi tên sẽ giữ nguyên cookies, proxy cố định, lịch sử và cấu hình campaign.
        </p>
      </div>

      <div className="card space-y-3">
        <label className="label">Trạng thái health (tự chỉnh)</label>
        <p className="text-xs text-surface-muted">
          Dùng khi Health Check tự động không chính xác. Trạng thái này hiển thị ở danh sách Accounts
          và được dùng khi Generate campaign (ưu tiên alive).
        </p>
        <div className="flex flex-wrap gap-2">
          {HEALTH_OPTIONS.map((opt) => (
            <button
              key={opt.value || 'unknown'}
              type="button"
              disabled={saving}
              title={opt.hint}
              onClick={() => setStatusQuick(opt.value)}
              className={`badge px-3 py-1.5 cursor-pointer border transition ${
                healthStatus === opt.value
                  ? `border-accent ring-1 ring-accent ${statusBadgeClass(opt.value)}`
                  : `border-surface-border opacity-80 hover:opacity-100 ${statusBadgeClass(opt.value)}`
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {lastHealthAt && (
          <p className="text-xs text-surface-muted">
            Cập nhật lúc: {new Date(lastHealthAt).toLocaleString()}
          </p>
        )}
      </div>

      <div>
        <label className="label flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>
      </div>
      <div>
        <label className="label">Ghi chú</label>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div>
        <h2 className="font-semibold mb-3">Thông tin đăng nhập Twitter/X</h2>
        <label className="label">Username, email hoặc số điện thoại</label>
        <div className="flex items-center gap-2">
          <input
            className="input flex-1"
            value={twitterUsername}
            onChange={(e) => setTwitterUsername(e.target.value)}
            placeholder="@username hoặc email đăng nhập"
            autoComplete="off"
          />
          {hasCredentials && (
            <span className="badge badge-alive text-xs whitespace-nowrap">Đã lưu creds</span>
          )}
        </div>
      </div>
      <div>
        <label className="label">Mật khẩu Twitter/X</label>
        <input
          className="input"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={hasCredentials ? '••••••• (giữ nguyên)' : 'Nhập password để bật auto-login'}
          autoComplete="new-password"
          disabled={clearPassword}
        />
        <p className="text-xs text-surface-muted mt-1">
          Password được mã hóa AES-256 trước khi lưu DB. Worker dùng khi cookie hết hạn.
        </p>
        {hasCredentials && (
          <label className="label flex items-center gap-2 mt-2 text-red-300">
            <input
              type="checkbox"
              checked={clearPassword}
              onChange={(e) => {
                setClearPassword(e.target.checked);
                if (e.target.checked) setNewPassword('');
              }}
            />
            Xóa mật khẩu Twitter/X đang lưu
          </label>
        )}
      </div>
      <div>
        <label className="label">Cookies mới (optional, paste JSON)</label>
        <textarea
          className="input min-h-[150px] sm:min-h-[160px] font-mono text-xs"
          value={cookiesJson}
          onChange={(e) => setCookiesJson(e.target.value)}
          placeholder="Để trống nếu không đổi cookies"
        />
      </div>
      {credSaved && <p className="text-green-400 text-sm">{credSaved}</p>}
      {err && <p className="text-accent-red text-sm">{err}</p>}
      <button
        className="btn btn-primary w-full sm:w-auto justify-center"
        onClick={save}
        disabled={saving}
      >
        {saving ? 'Đang lưu...' : 'Lưu'}
      </button>
    </div>
  );
}
