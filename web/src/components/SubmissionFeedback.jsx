import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function SubmissionFeedback({ kind, id }) {
  const { isAdmin, user, loading: authLoading } = useAuth();
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const load = useCallback(async () => {
    if (authLoading || !user) return;
    try {
      const data = await api.get(`/feedback/${kind}/${id}`);
      setItems(data.items); setTitle(data.title); setError('');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [kind, id, authLoading, user?.id]);
  useEffect(() => { load(); }, [load]);
  async function send(event) {
    event.preventDefault();
    if (!message.trim() || busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await api.post(`/feedback/${kind}/${id}`, { message: message.trim() });
      setMessage(''); setSuccess('Javob yuborildi. O‘quvchiga admin ismingiz bilan ko‘rinadi.');
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  if (!authLoading && !user) return <Link to="/login" className="block p-4 text-[#2f5d3a]">Javoblarni ko‘rish uchun hisobingizga kiring →</Link>;
  return <section aria-label="Admin javoblari" className="mt-4 rounded-2xl border border-[#dce6d5] bg-[#f6f9f3] p-4">
    <h2 className="font-bold text-[#2f5d3a]">💬 Admin javoblari</h2>
    {title && <p className="mt-1 text-sm text-[#6b7a6f]">{title}</p>}
    {loading ? <p className="mt-3 text-sm">Yuklanmoqda…</p> : !items.length && <p className="mt-3 text-sm text-[#6b7a6f]">Hozircha javob yozilmagan.</p>}
    <div className="mt-3 space-y-3">{items.map(item => <article key={item.id} className="rounded-xl bg-white p-3">
      <p className="text-sm font-bold">🛡️ {item.sender_name} <span className="font-normal text-[#6b7a6f]">· Admin</span></p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{item.message}</p>
      <time className="mt-2 block text-xs text-[#6b7a6f]">{item.created_at} UTC</time>
    </article>)}</div>
    {isAdmin && <form onSubmit={send} className="mt-4">
      <label className="block text-sm font-semibold">O‘quvchiga javob
        <textarea value={message} onChange={e => setMessage(e.target.value)} required maxLength={2000} rows={3} placeholder="Masalan: ish yaxshi, lekin natija rasmini qo‘shing yoki nima xato bo‘lganini tushuntiring…" className="mt-2 block w-full rounded-xl border border-[#d6ded1] bg-white p-3 font-normal" />
      </label>
      <p className="mt-2 text-xs text-[#6b7a6f]">Javob bildirishnomalarda saqlanadi, Telegram hisobi ulangan bo‘lsa bot orqali ham boradi. Bu tugma topshiriq holatini o‘zgartirmaydi.</p>
      <button disabled={busy || !message.trim()} className="mt-3 rounded-xl bg-[#2f5d3a] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Yuborilmoqda…' : 'Javobni yuborish'}</button>
    </form>}
    {success && <p role="status" className="mt-3 text-sm text-[#2f5d3a]">{success}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>;
}
