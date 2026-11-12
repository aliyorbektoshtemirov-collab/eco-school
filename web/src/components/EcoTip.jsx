import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

export default function EcoTip() {
  const [tip, setTip] = useState(null);
  const [closed, setClosed] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    let alive = true;
    api.get('/tips').then(data => {
      if (!alive) return;
      setTip(data.tip);
      try { setClosed(sessionStorage.getItem('eco-tip-dismissed') === String(data.tip.id)); } catch {}
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!tip || closed || ['/admin', '/setup', '/recycling-admin'].some(p => pathname.startsWith(p))) return null;
  return <aside aria-label="Bugungi eko tavsiya" className="mx-auto my-3 max-w-3xl px-4">
    <div className="relative rounded-3xl border border-[#dce8d6] bg-gradient-to-r from-[#edf5e7] to-[#fff7dc] p-5 pr-12">
      <p className="text-xs font-bold uppercase tracking-wider text-[#548052]">🐢 Timo tavsiya qiladi · bugun</p>
      <h2 className="mt-2 text-lg font-bold text-[#244b32]">{tip.title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#526450]">{tip.text}</p>
      <Link to={tip.path} className="mt-3 inline-block rounded-full bg-[#315b3b] px-4 py-2 text-sm font-semibold text-white">{tip.action} ↗</Link>
      <button aria-label="Tavsiyani yopish" onClick={() => { setClosed(true); try { sessionStorage.setItem('eco-tip-dismissed', String(tip.id)); } catch {} }} className="absolute right-3 top-3 rounded-full px-3 py-2 text-[#526450]">×</button>
    </div>
  </aside>;
}
