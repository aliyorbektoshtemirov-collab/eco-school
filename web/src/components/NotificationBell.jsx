import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
export default function NotificationBell() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user) { setUnread(0); return; }
    let alive = true;
    const load = () => api.get('/notifications').then(data => { if (alive) setUnread(data.unread); }).catch(() => {});
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener('notifications-changed', load);
    window.addEventListener('focus', load);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('notifications-changed', load); window.removeEventListener('focus', load); };
  }, [user?.id]);
  if (!user) return null;
  return <Link to="/notifications" aria-label={`Bildirishnomalar, ${unread} ta o‘qilmagan`} className="fixed right-4 bottom-24 z-40 flex items-center gap-2 rounded-full border border-[#dce6d5] bg-white px-4 py-3 text-sm font-bold text-[#2f5d3a] shadow-lg">
    🔔 <span>{unread ? `${unread} yangi` : 'Javoblar'}</span>
  </Link>;
}
