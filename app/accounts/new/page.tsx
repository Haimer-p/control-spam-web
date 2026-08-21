'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client';

export default function NewAccountPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [twitterUsername, setTwitterUsername] = useState('');
  const [password, setPassword] = useState('');
  const [cookiesJson, setCookiesJson] = useState('');
  const [err, setErr] = useState('');

  const submit = async () => {
    try {
      const cookies = cookiesJson.trim() ? JSON.parse(cookiesJson) : [];
      await apiFetch('/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ name, twitterUsername, password, cookies, enabled: true }),
      });
      router.push('/accounts');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">Thêm Account</h1>
      <div>
        <label className="label">Tên account</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label">Twitter username hoặc email</label>
        <input
          className="input"
          value={twitterUsername}
          onChange={(e) => setTwitterUsername(e.target.value)}
          autoComplete="username"
        />
      </div>
      <div>
        <label className="label">Mật khẩu Twitter</label>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <p className="text-xs text-surface-muted mt-1">
          Tùy chọn. Password được mã hóa trước khi lưu và có thể bổ sung sau.
        </p>
      </div>
      <div>
        <label className="label">Cookies JSON (paste từ accounts/*.json)</label>
        <textarea
          className="input min-h-[180px] sm:min-h-[200px] font-mono text-xs"
          value={cookiesJson}
          onChange={(e) => setCookiesJson(e.target.value)}
          placeholder="Tùy chọn — có thể để trống và bổ sung sau"
        />
      </div>
      {err && <p className="text-accent-red text-sm">{err}</p>}
      <button className="btn btn-primary w-full sm:w-auto justify-center" onClick={submit}>
        Lưu
      </button>
    </div>
  );
}
