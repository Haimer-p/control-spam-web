'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, useApiPoll } from '@/lib/client';
import { Shield, Plus, Trash2, RefreshCw, CheckCircle, XCircle, HelpCircle, Loader2, ExternalLink, Zap } from 'lucide-react';

const FREE_PROXY_SOURCES = [
  {
    name: 'Webshare',
    url: 'https://www.webshare.io/',
    desc: 'Free tier 10 proxy, tốc độ ổn, hỗ trợ HTTP/HTTPS/SOCKS5',
    badge: 'Khuyên dùng',
    badgeClass: 'text-green-400 bg-green-900/30 border-green-700/50',
  },
  {
    name: 'ProxyScrape',
    url: 'https://proxyscrape.com/free-proxy-list',
    desc: 'Danh sách proxy free HTTP/SOCKS4/SOCKS5, cập nhật thường xuyên',
    badge: 'Miễn phí',
    badgeClass: 'text-blue-400 bg-blue-900/30 border-blue-700/50',
  },
  {
    name: 'ProxyScrape GitHub mirror',
    url: 'https://github.com/proxyscrape/free-proxy-list',
    desc: 'Mirror chính thức dạng TXT/JSON, cập nhật mỗi 5 phút',
    badge: 'Miễn phí',
    badgeClass: 'text-blue-400 bg-blue-900/30 border-blue-700/50',
  },
  {
    name: 'Geonode Free Proxy',
    url: 'https://proxylist.geonode.com/api/proxy-list?limit=100&page=1&sort_by=lastChecked&sort_type=desc&protocols=http,https',
    desc: 'API JSON trả về danh sách proxy, filter theo country/speed/protocol',
    badge: 'API JSON',
    badgeClass: 'text-purple-400 bg-purple-900/30 border-purple-700/50',
  },
  {
    name: 'Databay strict SSL',
    url: 'https://github.com/databay-labs/free-proxy-list',
    desc: 'HTTP proxy đã kiểm tra HTTPS CONNECT và chứng chỉ TLS',
    badge: 'Miễn phí',
    badgeClass: 'text-blue-400 bg-blue-900/30 border-blue-700/50',
  },
  {
    name: 'IPLocate verified list',
    url: 'https://github.com/iplocate/free-proxy-list',
    desc: 'Danh sách HTTP/HTTPS đã kiểm tra, cập nhật mỗi 30 phút',
    badge: 'HTTPS',
    badgeClass: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50',
  },
  {
    name: 'GProxy checked list',
    url: 'https://github.com/gproxynet/free-proxy-list',
    desc: 'Mẫu proxy đã kiểm tra, làm mới mỗi 30 phút',
    badge: 'Chi tiết',
    badgeClass: 'text-gray-400 bg-gray-900/30 border-gray-700/50',
  },
  {
    name: 'Proxifly',
    url: 'https://github.com/proxifly/free-proxy-list',
    desc: 'Danh sách HTTP/HTTPS được làm mới khoảng mỗi 5 phút',
    badge: 'Nguồn mới',
    badgeClass: 'text-cyan-400 bg-cyan-900/30 border-cyan-700/50',
  },
  {
    name: 'Monosans proxy-list',
    url: 'https://github.com/monosans/proxy-list',
    desc: 'Proxy HTTP được kiểm tra lại hàng giờ và sắp xếp theo tốc độ',
    badge: 'Nguồn mới',
    badgeClass: 'text-cyan-400 bg-cyan-900/30 border-cyan-700/50',
  },
  {
    name: 'hproxy',
    url: 'https://github.com/hproxy-com/free-proxy-list',
    desc: 'Nguồn HTTP dự phòng, mọi proxy vẫn phải qua kiểm tra trực tiếp với X',
    badge: 'Nguồn phụ',
    badgeClass: 'text-gray-400 bg-gray-900/30 border-gray-700/50',
  },
  {
    name: 'Zaeem20 / JoyDeploy',
    url: 'https://github.com/Zaeem20/FREE_PROXIES_LIST',
    desc: 'Hai nguồn dự phòng HTTP/HTTPS, luôn phải qua kiểm tra TLS của worker',
    badge: 'Nguồn phụ',
    badgeClass: 'text-gray-400 bg-gray-900/30 border-gray-700/50',
  },
  {
    name: 'ProxyScrape safety notes',
    url: 'https://github.com/proxyscrape/free-proxy-list#caveats--read-this-if-you-actually-plan-to-use-these',
    desc: 'Không dùng proxy public để truyền password/cookie quan trọng',
    badge: 'Lọc nâng cao',
    badgeClass: 'text-gray-400 bg-gray-900/30 border-gray-700/50',
  },
];


type ProxyStatus = 'active' | 'dead' | 'untested';

type Proxy = {
  _id: string;
  url: string;
  label?: string;
  status: ProxyStatus;
  lastTestedAt?: string;
  lastUsedAt?: string;
  failCount: number;
  successCount: number;
  lastError?: string;
};

function StatusBadge({ status }: { status: ProxyStatus }) {
  if (status === 'active')
    return (
      <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
        <CheckCircle className="w-3.5 h-3.5" /> Active
      </span>
    );
  if (status === 'dead')
    return (
      <span className="flex items-center gap-1 text-red-400 text-xs font-medium">
        <XCircle className="w-3.5 h-3.5" /> Dead
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-gray-400 text-xs font-medium">
      <HelpCircle className="w-3.5 h-3.5" /> Untested
    </span>
  );
}

export default function ProxiesPage() {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [bulkInput, setBulkInput] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState('');
  const [testing, setTesting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [autoFetching, setAutoFetching] = useState(false);

  const { data: runtime } = useApiPoll<{ online: boolean }>('/api/runtime', 8000);

  const loadProxies = useCallback(async () => {
    const data = await apiFetch('/api/proxies');
    setProxies(data.proxies || []);
  }, []);

  useEffect(() => {
    loadProxies().catch(console.error);
  }, [loadProxies]);

  // Poll while testing or autoFetching
  useEffect(() => {
    if (!testing && !autoFetching) return;
    const timer = setInterval(() => loadProxies().catch(() => {}), 3000);
    return () => clearInterval(timer);
  }, [testing, autoFetching, loadProxies]);

  const autoFetchFreeProxies = async () => {
    setAutoFetching(true);
    setMsg('⚡ Đang lấy proxy HTTP đã kiểm tra từ ProxyScrape, Databay, IPLocate, GProxy và Geonode...');
    try {
      const res = await apiFetch('/api/proxies/auto-fetch', {
        method: 'POST',
        body: JSON.stringify({ limit: 300, autoTest: true }),
      });
      setMsg(`🎉 Đã tìm thấy ${res.found} proxy và thêm thành công ${res.added} proxy mới vào hệ thống! ${runtime?.online ? '(Đang tự động test...)' : ''}`);
      await loadProxies();
      const sourceCount = Array.isArray(res.sources)
        ? res.sources.filter((source: { ok?: boolean }) => source.ok).length
        : 0;
      setMsg(
        `Đã tổng hợp ${res.found}/${res.totalUnique || res.found} proxy từ ${sourceCount} nguồn, ` +
        `thêm ${res.added} proxy mới. Proxy mới đang được worker kiểm tra trực tiếp với x.com.`
      );
      if (runtime?.online) {
        setTesting(true);
        setTimeout(() => setTesting(false), 25000);
      }
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Lỗi khi cào proxy'}`);
    } finally {
      setAutoFetching(false);
    }
  };

  const addProxies = async () => {
    const urls = bulkInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!urls.length) return;
    setAdding(true);
    setMsg('');
    try {
      const res = await apiFetch('/api/proxies', {
        method: 'POST',
        body: JSON.stringify({ urls }),
      });
      setBulkInput('');
      setMsg(`✅ Đã thêm ${res.count} proxy`);
      await loadProxies();
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Error'}`);
    } finally {
      setAdding(false);
    }
  };

  const deleteSelected = async () => {
    if (!selected.size) return;
    try {
      await apiFetch('/api/proxies', {
        method: 'DELETE',
        body: JSON.stringify({ ids: [...selected] }),
      });
      setSelected(new Set());
      setMsg(`🗑️ Đã xóa ${selected.size} proxy`);
      await loadProxies();
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Error'}`);
    }
  };

  const deleteDeadProxies = async () => {
    try {
      const res = await apiFetch('/api/proxies', {
        method: 'DELETE',
        body: JSON.stringify({ allDead: true }),
      });
      setMsg(`🗑️ Đã tự động dọn sạch ${res.deletedCount || 0} proxy dead`);
      await loadProxies();
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Error'}`);
    }
  };

  const testAll = async () => {
    if (!runtime?.online) {
      setMsg('❌ Worker offline — khởi động worker trước');
      return;
    }
    setTesting(true);
    setMsg('🔄 Đang test proxy... Proxy chết sẽ tự động bị xóa bỏ khỏi hệ thống!');
    try {
      await apiFetch('/api/proxies/test', { method: 'POST' });
      setTimeout(() => setTesting(false), 30000);
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Error'}`);
      setTesting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === proxies.length) setSelected(new Set());
    else setSelected(new Set(proxies.map((p) => p._id)));
  };

  const stats = {
    active: proxies.filter((p) => p.status === 'active').length,
    dead: proxies.filter((p) => p.status === 'dead').length,
    untested: proxies.filter((p) => p.status === 'untested').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent" />
            Proxy Pool
          </h1>
          <p className="text-surface-muted text-sm">
            Quản lý proxy — hệ thống tự động loại bỏ proxy chết để giữ pool luôn sạch
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            className="btn bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-300 hover:from-amber-500/30 hover:to-orange-500/30 flex items-center gap-2 text-sm font-medium"
            onClick={autoFetchFreeProxies}
            disabled={autoFetching}
          >
            {autoFetching ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <Zap className="w-4 h-4 text-amber-400" />
            )}
            ⚡ Tự Động Lấy Proxy Free
          </button>
          <button
            className="btn btn-secondary flex items-center gap-2 text-sm"
            onClick={testAll}
            disabled={testing}
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Test All (Auto Clean Dead)
          </button>
          {stats.dead > 0 && (
            <button
              className="btn flex items-center gap-2 text-sm bg-red-900/40 border-red-700 text-red-400 hover:bg-red-900/60"
              onClick={deleteDeadProxies}
            >
              <Trash2 className="w-4 h-4" />
              Xóa {stats.dead} Dead
            </button>
          )}
          {selected.size > 0 && (
            <button
              className="btn flex items-center gap-2 text-sm bg-gray-800 border-surface-border text-gray-300 hover:bg-gray-700"
              onClick={deleteSelected}
            >
              <Trash2 className="w-4 h-4" />
              Xóa đã chọn ({selected.size})
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-green-400">{stats.active}</div>
          <div className="text-xs text-surface-muted mt-0.5">Active</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-gray-400">{stats.untested}</div>
          <div className="text-xs text-surface-muted mt-0.5">Untested</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-red-400">{stats.dead}</div>
          <div className="text-xs text-surface-muted mt-0.5">Dead</div>
        </div>
      </div>

      {/* Free Proxy Sources */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-accent" />
          Nguồn Proxy Miễn Phí
        </h2>
        <p className="text-xs text-surface-muted">
          💡 Proxy free thường die nhanh — nên dùng <strong className="text-accent">Webshare</strong> (10 proxy free/tháng, ổn định nhất).
          Sau khi lấy được danh sách, paste vào ô bên dưới.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FREE_PROXY_SOURCES.map((src) => (
            <a
              key={src.url}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-3 rounded-lg border border-surface-border hover:border-accent/50 hover:bg-accent/5 transition group"
            >
              <ExternalLink className="w-4 h-4 text-surface-muted group-hover:text-accent shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm group-hover:text-accent transition">{src.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${src.badgeClass}`}>
                    {src.badge}
                  </span>
                </div>
                <p className="text-xs text-surface-muted mt-0.5 leading-relaxed">{src.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Add Proxies */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Plus className="w-4 h-4 text-accent" />
          Thêm Proxy (mỗi dòng 1 proxy)
        </h2>
        <p className="text-xs text-surface-muted">
          Hỗ trợ các định dạng: <code className="bg-surface-border px-1 rounded">http://host:port</code>{' '}
          • <code className="bg-surface-border px-1 rounded">http://user:pass@host:port</code>{' '}
          • <code className="bg-surface-border px-1 rounded">socks5://host:port</code>
        </p>
        <textarea
          className="input min-h-[120px] font-mono text-xs"
          value={bulkInput}
          onChange={(e) => setBulkInput(e.target.value)}
          placeholder={'http://1.2.3.4:8080\nhttp://user:pass@5.6.7.8:3128\nsocks5://9.10.11.12:1080'}
        />
        <button
          className="btn btn-primary flex items-center gap-2 text-sm"
          onClick={addProxies}
          disabled={adding || !bulkInput.trim()}
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Thêm Proxy
        </button>
      </div>


      {msg && (
        <p className="text-sm text-surface-muted bg-surface-card border border-surface-border rounded-lg px-4 py-2">
          {msg}
        </p>
      )}

      {/* Proxy List */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-surface-border">
            <tr>
              <th className="px-4 py-3 text-left w-8">
                <input
                  type="checkbox"
                  checked={proxies.length > 0 && selected.size === proxies.length}
                  onChange={toggleAll}
                  className="cursor-pointer"
                />
              </th>
              <th className="px-4 py-3 text-left text-surface-muted font-medium">URL</th>
              <th className="px-4 py-3 text-left text-surface-muted font-medium">Status</th>
              <th className="px-4 py-3 text-left text-surface-muted font-medium hidden md:table-cell">
                ✓/✗
              </th>
              <th className="px-4 py-3 text-left text-surface-muted font-medium hidden lg:table-cell">
                Tested
              </th>
              <th className="px-4 py-3 text-left text-surface-muted font-medium hidden lg:table-cell">
                Last Error
              </th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {proxies.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-surface-muted text-sm">
                  Chưa có proxy nào. Thêm proxy phía trên.
                </td>
              </tr>
            ) : (
              proxies.map((proxy) => (
                <tr
                  key={proxy._id}
                  className={`border-b border-surface-border last:border-0 transition hover:bg-surface-border/20 ${
                    selected.has(proxy._id) ? 'bg-accent/5' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(proxy._id)}
                      onChange={() => toggleSelect(proxy._id)}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs break-all">
                      {/* Mask password in URL */}
                      {proxy.url.replace(/:[^:@]+@/, ':***@')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={proxy.status} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-green-400">{proxy.successCount}</span>
                    <span className="text-surface-muted mx-1">/</span>
                    <span className="text-red-400">{proxy.failCount}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-surface-muted text-xs">
                    {proxy.lastTestedAt
                      ? new Date(proxy.lastTestedAt).toLocaleString('vi-VN')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-red-400 text-xs max-w-[200px] truncate">
                    {proxy.lastError || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="btn btn-ghost p-1.5 text-red-400 hover:bg-red-900/20"
                      onClick={async () => {
                        await apiFetch('/api/proxies', {
                          method: 'DELETE',
                          body: JSON.stringify({ ids: [proxy._id] }),
                        });
                        await loadProxies();
                      }}
                      title="Xóa proxy"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!runtime?.online && proxies.length > 0 && (
        <p className="text-sm text-yellow-400 bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-4 py-2">
          ⚠️ Worker offline — cần khởi động worker để test proxy
        </p>
      )}
    </div>
  );
}
