import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!authLoading && !user) navigate('/login', { replace: true }); }, [authLoading, user, navigate]);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [more, setMore] = useState(false);
  const load = useCallback(async () => {
    if (authLoading || !user) return;
    try {
      const data = await api.get('/notifications');
      setItems(data.items); setUnread(data.unread); setMore(data.items.length === 50); setError('');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [authLoading, user?.id]);
  useEffect(() => {
    if (authLoading || !user) return;
    load();
    const timer = setInterval(() => {
      api.get('/notifications').then(data => setUnread(data.unread)).catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [load]);
  async function read(item) {
    try {
      const data = await api.post(`/notifications/${item.id}/read`, {});
      setItems(old => old.map(i => i.id === item.id ? { ...i, read_at: 'read' } : i));
      setUnread(data.unread);
      window.dispatchEvent(new Event('notifications-changed'));
    } catch (err) { setError(err.message); }
  }
  async function older() {
    try {
      const data = await api.get(`/notifications?before=${items.at(-1).id}`);
      setItems(old => [...old, ...data.items]); setMore(data.items.length === 50);
    } catch (err) { setError(err.message); }
  }
  return <main className="mx-auto min-h-screen max-w-3xl px-4 py-6 pb-28 text-[#1f2b22]">
    <Link to="/profile" className="text-sm text-[#2f5d3a]">← Profil</Link>
    <div className="mt-4 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">🔔 Bildirishnomalar</h1>
      <button onClick={load} className="rounded-xl border px-3 py-2 text-sm">Yangilash</button>
    </div>
    <p className="mt-2 text-sm text-[#6b7a6f]">{unread} ta o‘qilmagan javob</p>
    {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
    {loading && <p className="mt-5">Yuklanmoqda…</p>}
    {!loading && !error && !items.length && <p className="mt-6 rounded-2xl border bg-white p-6">Admin javob yozganda shu yerda ko‘rinadi.</p>}
    <div className="mt-5 space-y-4">{items.map(item => <article key={item.id} className={`rounded-2xl border p-5 ${item.read_at ? 'bg-white' : 'border-[#a8c59a] bg-[#f0f7e9]'}`}>
      <p className="text-xs font-bold text-[#2f5d3a]">{item.read_at ? 'ADMIN JAVOBI' : 'YANGI JAVOB'}</p>
      <h2 className="mt-2 text-lg font-bold">{item.title}</h2>
      <p className="mt-1 text-sm font-semibold">🛡️ {item.sender_name} · Admin</p>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{item.message}</p>
      <time className="mt-3 block text-xs text-[#6b7a6f]">{item.created_at} UTC</time>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link to={`/feedback/${item.submission_type}/${item.submission_id}`} className="text-sm font-semibold text-[#2f5d3a]">Barcha javoblar →</Link>
        {!item.read_at && <button onClick={() => read(item)} className="text-sm underline">O‘qildi</button>}
      </div>
    </article>)}</div>
    {more && <button onClick={older} className="mt-4 rounded-xl border px-4 py-3">Oldingi javoblar</button>}
  </main>;
}
