const https = require('https');
const http = require('http');

class ProxyFetcher {
  static fetchUrl(url, timeoutMs = 10000, redirectsLeft = 3) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const client = url.startsWith('https:') ? https : http;
      const req = client.get(
        url,
        {
          headers: {
            'User-Agent': 'twitter-bot-dashboard/1.0 (+proxy-discovery)',
            Accept: 'text/plain, application/json;q=0.9, */*;q=0.5',
          },
          timeout: timeoutMs,
        },
        (res) => {
          if (
            redirectsLeft > 0 &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            res.resume();
            finish(
              this.fetchUrl(
                new URL(res.headers.location, url).toString(),
                timeoutMs,
                redirectsLeft - 1
              )
            );
            return;
          }
          let data = '';
          let receivedBytes = 0;
          const maxBytes = 10 * 1024 * 1024;
          const declaredBytes = Number(res.headers['content-length'] || 0);
          if (declaredBytes > maxBytes) {
            res.destroy();
            finish({ ok: false, error: 'Response exceeds 10MB limit' });
            return;
          }
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            receivedBytes += Buffer.byteLength(chunk, 'utf8');
            if (receivedBytes > maxBytes) {
              res.destroy();
              finish({ ok: false, error: 'Response exceeds 10MB limit' });
              return;
            }
            data += chunk;
          });
          res.on('aborted', () => finish({ ok: false, error: 'Response aborted' }));
          res.on('error', (err) => finish({ ok: false, error: err.message }));
          res.on('end', () =>
            finish({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              statusCode: res.statusCode,
              data,
            })
          );
        }
      );
      req.on('error', (err) => finish({ ok: false, error: err.message }));
      req.on('timeout', () => req.destroy(new Error('timeout')));
    });
  }

  static isValidIpPort(host, port) {
    const octets = String(host).split('.').map(Number);
    const numericPort = Number(port);
    return (
      octets.length === 4 &&
      octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) &&
      Number.isInteger(numericPort) &&
      numericPort >= 1 &&
      numericPort <= 65535
    );
  }

  static extractProxiesFromText(text, defaultProtocol = 'http') {
    if (!text) return [];
    const proxies = [];
    for (const token of String(text).split(/\s+/)) {
      const match = token.match(
        /^(?:(https?):\/\/)?((?:[0-9]{1,3}\.){3}[0-9]{1,3}):([0-9]{1,5})$/i
      );
      if (!match) continue;
      if (!this.isValidIpPort(match[2], match[3])) continue;
      const protocol = (match[1] || defaultProtocol).toLowerCase();
      if (protocol === 'http' || protocol === 'https') {
        proxies.push(`${protocol}://${match[2]}:${match[3]}`);
      }
    }
    return [...new Set(proxies)];
  }

  static async fetchFromGeonode(limit) {
    try {
      const url = `https://proxylist.geonode.com/api/proxy-list?limit=${limit}&page=1&sort_by=lastChecked&sort_type=desc&protocols=http%2Chttps`;
      const res = await this.fetchUrl(url, 12000);
      if (!res.ok) return [];
      const json = JSON.parse(res.data);
      return (Array.isArray(json.data) ? json.data : [])
        .filter((item) => this.isValidIpPort(item.ip, item.port))
        .map((item) => {
          return `http://${item.ip}:${item.port}`;
        });
    } catch {
      return [];
    }
  }

  static getSources() {
    return [
      ['ProxyScrape v4 filtered', 'http', 4, 'https://api.proxyscrape.com/v4/free-proxy-list/get?request=getproxies&protocol=http&timeout=5000&ssl=yes&anonymity=elite%2Canonymous&limit=200&proxy_format=protocolipport'],
      ['Databay fast strict SSL API', 'http', 3, 'https://databay.com/api/v1/proxy-list?protocol=http&ssl=strict&speed=fast&format=txt&limit=200&page=1'],
      ['Monosans hourly HTTP', 'http', 2, 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt'],
      ['IPLocate HTTP', 'http', 2, 'https://raw.githubusercontent.com/iplocate/free-proxy-list/main/protocols/http.txt'],
      ['IPLocate HTTPS', 'http', 1, 'https://raw.githubusercontent.com/iplocate/free-proxy-list/main/protocols/https.txt'],
      ['GProxy checked HTTP', 'http', 1, 'https://raw.githubusercontent.com/gproxynet/free-proxy-list/main/http.txt'],
      ['ProxyScrape mirror fallback', 'http', 1, 'https://cdn.jsdelivr.net/gh/proxyscrape/free-proxy-list@main/proxies/protocols/http/data.txt'],
      ['Proxifly fallback', 'http', 1, 'https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/http/data.txt'],
      ['hproxy fallback', 'http', 1, 'https://raw.githubusercontent.com/hproxy-com/free-proxy-list/main/http.txt'],
      ['Zaeem20 HTTP', 'http', 1, 'https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/master/http.txt'],
      ['JoyDeploy HTTP', 'http', 1, 'https://raw.githubusercontent.com/thenasty1337/free-proxy-list/main/data/latest/types/http/proxies.txt'],
    ];
  }

  static async fetchAllDetailed(totalLimit = 150) {
    const limit = Math.max(1, Math.min(Number(totalLimit) || 150, 1000));
    const requests = this.getSources().map(async ([name, protocol, priority, url]) => {
      const res = await this.fetchUrl(url, 12000);
      const proxies = res.ok ? this.extractProxiesFromText(res.data, protocol) : [];
      return {
        name,
        priority,
        ok: res.ok && proxies.length > 0,
        fetched: proxies.length,
        error: res.ok ? (proxies.length ? undefined : 'No valid HTTP proxies') : (res.error || `HTTP ${res.statusCode}`),
        proxies,
      };
    });
    const settled = await Promise.allSettled([
      this.fetchFromGeonode(Math.min(limit, 100)).then((proxies) => ({
        name: 'Geonode API',
        priority: 1,
        ok: proxies.length > 0,
        fetched: proxies.length,
        error: proxies.length ? undefined : 'No valid HTTP proxies',
        proxies,
      })),
      ...requests,
    ]);
    const sources = this.getSources();
    const reports = settled.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      return {
        name: index === 0 ? 'Geonode API' : sources[index - 1]?.[0] || `Source ${index}`,
        priority: index === 0 ? 1 : sources[index - 1]?.[2] || 1,
        ok: false,
        fetched: 0,
        error: result.reason?.message || String(result.reason || 'Fetch failed'),
        proxies: [],
      };
    });
    const output = [];
    const seen = new Set();
    let row = 0;
    while (
      output.length < limit &&
      reports.some((report) => row * report.priority < report.proxies.length)
    ) {
      for (const report of reports) {
        for (let offset = 0; offset < report.priority; offset++) {
          const proxy = report.proxies[row * report.priority + offset];
          if (proxy && !seen.has(proxy)) {
            seen.add(proxy);
            output.push(proxy);
            if (output.length >= limit) break;
          }
        }
        if (output.length >= limit) break;
      }
      row += 1;
    }
    return {
      proxies: output,
      totalUnique: new Set(reports.flatMap((report) => report.proxies)).size,
      sources: reports.map(({ proxies, ...report }) => report),
    };
  }

  static async fetchAll(totalLimit = 150) {
    return (await this.fetchAllDetailed(totalLimit)).proxies;
  }
}

module.exports = ProxyFetcher;
