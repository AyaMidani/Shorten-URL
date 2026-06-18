import { useEffect, useState } from 'react';

const isValidUrl = (str) => {
  try { new URL(str); return true; } catch { return false; }
};
const withHttp = (u) => (/^https?:\/\//i.test(u) ? u : `http://${u}`);
const loadHistory = () => {
  try { return JSON.parse(localStorage.getItem('short_history') || '[]'); } catch { return []; }
};
const saveHistory = (items) => localStorage.setItem('short_history', JSON.stringify(items));

const LinkIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 17H7A5 5 0 0 1 7 7h2" />
    <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);
const CopyIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const ExternalIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
const TrashIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);
const CheckIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const SpinnerIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export default function UrlShortenerPortfolio() {
  const [url, setUrl] = useState('');
  const [expiry, setExpiry] = useState('24');
  const [customShort, setCustomShort] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(loadHistory());
  const [copiedKey, setCopiedKey] = useState(null);

  const apiBase = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

  useEffect(() => { saveHistory(history); }, [history]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!isValidUrl(url)) {
      setError('Please enter a valid URL (e.g., https://example.com)');
      return;
    }
    setLoading(true);
    try {
      const endpoint = `${apiBase}/api/v1`; // NO trailing slash
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
        url, 
        expiry: Number(expiry), 
        short: customShort || ''
      }),
      });
      const data = await res.json();
      console.log("rate limit", res.headers.get('X-RateLimit-Limit'));
console.log("remaining", res.headers.get('X-RateLimit-Remaining'));
console.log("reset", res.headers.get('X-RateLimit-Reset'));
      if (!res.ok) throw new Error(data?.message || 'Request failed');

      // Normalize outputs from various handlers
      const code =
        data.code ||
        data.id ||
        (data.short_url ? String(data.short_url).split('/').pop()
          : (data.short ? String(data.short).split('/').pop() : ''));

      const rawShort =
        data.short_url ||                 // e.g. "http://localhost:3000/abc123"
        data.short ||                     // e.g. "localhost:3000/abc123"
        `${window.location.origin}/${code}`;

      const short = withHttp(String(rawShort).trim()); // <-- ensure protocol
      const item = { url, short, code, expiry: Number(expiry), at: new Date().toISOString() };
      setResult(item);
      setHistory(([item, ...history]).slice(0, 20));
      setUrl('');
      setCustomShort(''); 
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {}
  };

  const removeItem = (idx) => {
    const next = history.filter((_, i) => i !== idx);
    setHistory(next);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-sky-50 text-slate-800">
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14">
        <header className="mb-10 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-lg shadow-indigo-200">
            <LinkIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">URL Shortener</h1>
            <p className="text-sm text-slate-500">Tiny frontend to pair with your Go + Redis service.</p>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200/80 bg-white/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-slate-200/60">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700">Long URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article/123..."
                className={`mt-1.5 w-full rounded-xl border bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none transition-shadow focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400 ${error ? 'border-rose-300' : 'border-slate-300'}`}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Custom Short Code <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={customShort}
                onChange={(e) => setCustomShort(e.target.value)}
                placeholder="e.g. mylink"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none transition-shadow focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Expiry (hours)</label>
              <select
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition-shadow focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400"
              >
                {['1', '6', '12', '24', '48', '72', '168'].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-3.5 py-2.5 text-sm">{error}</div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 px-5 py-2.5 font-medium text-white shadow-md shadow-indigo-200 transition hover:shadow-lg hover:brightness-105 disabled:opacity-60 disabled:shadow-none"
              >
                {loading && <SpinnerIcon className="h-4 w-4 animate-spin" />}
                {loading ? 'Shortening…' : 'Shorten URL'}
              </button>
              <span className="text-xs text-slate-400">API: {apiBase || '(same origin)'}</span>
            </div>
          </form>

          {result && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
              <h3 className="flex items-center gap-1.5 font-semibold text-emerald-800 mb-2">
                <CheckIcon className="h-4 w-4" />
                Short URL created
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <a className="text-sky-700 underline break-all font-medium" href={result.short} target="_blank" rel="noreferrer">{result.short}</a>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => copy(result.short, 'result')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 transition">
                    {copiedKey === 'result' ? <CheckIcon className="h-3.5 w-3.5 text-emerald-600" /> : <CopyIcon className="h-3.5 w-3.5" />}
                    {copiedKey === 'result' ? 'Copied' : 'Copy'}
                  </button>
                  <a href={result.short} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 transition">
                    <ExternalIcon className="h-3.5 w-3.5" />
                    Open
                  </a>
                </div>
              </div>
              <p className="text-xs text-emerald-700/70 mt-2">Expires in ~{result.expiry}h • code: {result.code || '(n/a)'} • saved locally</p>
            </div>
          )}
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Recent links</h2>
            {!!history.length && (
              <button onClick={() => { setHistory([]); }} className="text-sm font-medium text-rose-600 hover:text-rose-700 hover:underline">Clear</button>
            )}
          </div>
          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 py-10 text-center">
              <p className="text-slate-500 text-sm">No links yet. Create one above to see it here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-slate-500">Original</th>
                    <th className="text-left p-3 font-medium text-slate-500">Short</th>
                    <th className="text-left p-3 font-medium text-slate-500">When</th>
                    <th className="text-left p-3 font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 max-w-[280px] truncate"><a className="text-slate-700 hover:underline" href={item.url} target="_blank" rel="noreferrer">{item.url}</a></td>
                      <td className="p-3"><a className="text-sky-700 hover:underline font-medium" href={item.short} target="_blank" rel="noreferrer">{item.short}</a></td>
                      <td className="p-3 text-slate-500 whitespace-nowrap">{new Date(item.at).toLocaleString()}</td>
                      <td className="p-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => copy(item.short, idx)} title="Copy" className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 transition">
                            {copiedKey === idx ? <CheckIcon className="h-3.5 w-3.5 text-emerald-600" /> : <CopyIcon className="h-3.5 w-3.5" />}
                          </button>
                          <a href={item.short} target="_blank" rel="noreferrer" title="Open" className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 transition">
                            <ExternalIcon className="h-3.5 w-3.5" />
                          </a>
                          <button onClick={() => removeItem(idx)} title="Delete" className="rounded-lg border border-slate-200 p-1.5 text-rose-500 hover:bg-rose-50 transition">
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
