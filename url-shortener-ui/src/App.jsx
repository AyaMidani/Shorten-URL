import React, { useEffect, useMemo, useState } from 'react';

function classNames(...xs) { return xs.filter(Boolean).join(' '); }

const isValidUrl = (str) => {
  try { new URL(str); return true; } catch { return false; }
};
const withHttp = (u) => (/^https?:\/\//i.test(u) ? u : `http://${u}`);
const loadHistory = () => {
  try { return JSON.parse(localStorage.getItem('short_history') || '[]'); } catch { return []; }
};
const saveHistory = (items) => localStorage.setItem('short_history', JSON.stringify(items));

export default function UrlShortenerPortfolio() {
  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [expiry, setExpiry] = useState('24');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(loadHistory());

  // base API – use query param ?api= to override
  const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');


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
        body: JSON.stringify({ url, expiry: Number(expiry) }),
      });
      const data = await res.json();
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
      setAlias('');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); alert('Copied!'); } catch {}
  };

  const removeItem = (idx) => {
    const next = history.filter((_, i) => i !== idx);
    setHistory(next);
  };

  return (
  <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-800">
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">URL Shortener</h1>
          <p className="text-slate-600">Tiny frontend to pair with your Go + Redis service. Built with React + Tailwind.</p>
        </header>

        <section className="bg-white/70 backdrop-blur border border-slate-200 rounded-2xl shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Long URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article/123..."
                className={classNames(
                  'mt-1 w-full rounded-xl border px-3 py-2 outline-none',
                  'focus:ring-2 focus:ring-sky-400',
                  error ? 'border-rose-400' : 'border-slate-300'
                )}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Expiry (hours)</label>
                <select
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-sky-400"
                >
                  {['1','6','12','24','48','72','168'].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Custom alias (optional)</label>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="e.g. aya-youtube"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-sky-400"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center rounded-xl bg-sky-600 px-4 py-2 text-white hover:bg-sky-700 disabled:opacity-60"
              >
                {loading ? 'Shortening…' : 'Shorten URL'}
              </button>
              <span className="text-xs text-slate-500">API: {apiBase}</span>
            </div>
          </form>

          {result && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold mb-2">Short URL created</h3>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <a className="text-sky-700 underline break-all" href={result.short} target="_blank" rel="noreferrer">{result.short}</a>
                <div className="flex gap-2">
                  <button onClick={() => copy(result.short)} className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50">Copy</button>
                  <a href={result.short} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50">Open</a>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">Expires in ~{result.expiry}h • code: {result.code || '(n/a)'} • saved locally</p>
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between mb-2">
            <h2 className="text-lg font-semibold">Recent links</h2>
            {!!history.length && (
              <button onClick={() => { setHistory([]); }} className="text-sm text-rose-600 hover:underline">Clear</button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-slate-500 text-sm">No links yet. Create one above to see it here.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">Original</th>
                    <th className="text-left p-3">Short</th>
                    <th className="text-left p-3">When</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-3 max-w-[280px] truncate"><a className="underline text-slate-700" href={item.url} target="_blank" rel="noreferrer">{item.url}</a></td>
                      <td className="p-3"><a className="underline text-sky-700" href={item.short} target="_blank" rel="noreferrer">{item.short}</a></td>
                      <td className="p-3 text-slate-500">{new Date(item.at).toLocaleString()}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button onClick={() => copy(item.short)} className="rounded-lg border border-slate-300 px-2 py-1 hover:bg-slate-50">Copy</button>
                          <a href={item.short} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-2 py-1 hover:bg-slate-50">Open</a>
                          <button onClick={() => removeItem(idx)} className="rounded-lg border border-slate-300 px-2 py-1 hover:bg-slate-50 text-rose-600">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-10 text-xs text-slate-500">
          <p>Tip: pass <code>?api=http://localhost:3000</code> to point this UI at a different backend base URL.</p>
        </footer>
      </div>
    </div>
  );
}
