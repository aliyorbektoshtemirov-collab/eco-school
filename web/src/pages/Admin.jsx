import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, fileUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  ClassTag,
  ConfirmAction,
  CounterTab,
  EmptyState,
  Notice,
  Segmented,
  shortDate,
  statusOf,
} from '../components/console';

const MATERIAL = { paper: 'Qog‘oz', plastic: 'Plastik' };

export default function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [tab, setTab] = useState('challenges');
  const [summary, setSummary] = useState({ pending: {}, users: 0 });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [denied, setDenied] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await api.get('/admin/summary'));
    } catch (err) {
      if (err.status === 401) navigate('/login');
      else if (err.status === 403) setDenied(true);
    }
  }, [navigate]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  if (denied) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f5ef] px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold text-[#1f2b22]">Bu sahifa adminlar uchun</h1>
          <p className="mt-3 text-[14px] leading-6 text-[#6b7a6f]">
            Panelga faqat admin huquqi berilgan hisoblar kira oladi. Sizni qo‘shish
            kerak bo‘lsa, maktabdagi mas’ul o‘qituvchiga ayting.
          </p>
          <Link to="/" className="mt-7 inline-block text-[14px] font-medium text-[#2f5d3a] underline">
            Bosh sahifaga qaytish
          </Link>
        </div>
      </main>
    );
  }

  const after = (text) => {
    setMessage(text);
    loadSummary();
  };

  return (
    <main className="min-h-screen bg-[#f3f5ef] pb-20 text-[#1f2b22]">
      {/* ---------------------------------------------------------- sarlavha */}
      <div className="border-b border-[#e2e8dd] bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-baseline gap-3">
            <Link to="/" className="text-[14px] text-[#6b7a6f] hover:text-[#1f2b22]">
              ←
            </Link>
            <h1 className="text-[17px] font-bold">Admin panel</h1>
          </div>

          <p className="text-[13px] text-[#6b7a6f]">
            {user?.full_name}
            <span className="ml-2 rounded-md bg-[#ecf3ea] px-2 py-0.5 font-semibold text-[#2f5d3a]">
              {isOwner ? 'owner' : 'admin'}
            </span>
          </p>
        </div>

        {/* Hisoblagichlar bir vaqtning o'zida bo'lim almashtirgich */}
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3">
          <CounterTab
            active={tab === 'challenges'}
            label="Topshiriq"
            tone="warn"
            value={summary.pending?.challenges ?? 0}
            onClick={() => setTab('challenges')}
          />
          <CounterTab
            active={tab === 'recycling'}
            label="Recycling"
            tone="warn"
            value={summary.pending?.recycling ?? 0}
            onClick={() => setTab('recycling')}
          />
          <CounterTab
            active={tab === 'research'}
            label="Tadqiqot"
            tone="warn"
            value={summary.pending?.research ?? 0}
            onClick={() => setTab('research')}
          />
          <CounterTab
            active={tab === 'tasks'}
            label="Vazifalar"
            value={summary.challenges ?? 0}
            onClick={() => setTab('tasks')}
          />
          <CounterTab
            active={tab === 'marathon'}
            label="Marafon"
            value={summary.marathons ?? 0}
            onClick={() => setTab('marathon')}
          />
          <CounterTab
            active={tab === 'news'}
            label="E’lon"
            value={summary.announcements ?? 0}
            onClick={() => setTab('news')}
          />
          <CounterTab
            active={tab === 'users'}
            label="O‘quvchi"
            value={summary.users ?? 0}
            onClick={() => setTab('users')}
          />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 pt-7">
        <Notice kind="error" onClose={() => setError('')}>{error}</Notice>
        <Notice onClose={() => setMessage('')}>{message}</Notice>

        {tab === 'challenges' && <ChallengeQueue onDone={after} onError={setError} />}
        {tab === 'recycling' && <RecyclingQueue onDone={after} onError={setError} />}
        {tab === 'research' && <ResearchNote />}
        {tab === 'tasks' && <ChallengeAdmin onDone={after} onError={setError} />}
        {tab === 'marathon' && <MarathonAdmin onDone={after} onError={setError} />}
        {tab === 'news' && (
          <AnnouncementAdmin isOwner={isOwner} onDone={after} onError={setError} />
        )}
        {tab === 'users' && <UserList isOwner={isOwner} onDone={after} onError={setError} />}
      </div>
    </main>
  );
}

/* ================================================================ navbat */

function useQueue(path) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(path);
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, reload: load };
}

function QueueShell({ filter, setFilter, counts, loading, children, empty }) {
  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-4">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'pending', label: 'Kutilmoqda', count: counts.pending },
            { value: 'approved', label: 'Tasdiqlangan', count: counts.approved },
            { value: 'rejected', label: 'Rad etilgan', count: counts.rejected },
          ]}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[62px] animate-pulse rounded-xl bg-white/70" />
          ))}
        </div>
      ) : (
        children ?? empty
      )}
    </>
  );
}

/** Qator: yopiq holatda zich, ochilganda dalil va tugmalar. */
function QueueRow({ open, onToggle, status, title, who, klass, meta, right, children }) {
  const s = statusOf(status);

  return (
    <article
      className={`overflow-hidden rounded-xl border bg-white transition-shadow ${
        open ? 'border-[#cfd9c9] shadow-[0_4px_16px_rgba(31,43,34,0.07)]' : 'border-[#e8ede3]'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-[#fafbf8]"
      >
        <span className="h-9 w-[3px] shrink-0 rounded-full" style={{ background: s.edge }} />

        <ClassTag>{klass}</ClassTag>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{title}</span>
          <span className="mt-0.5 block truncate text-[13px] text-[#6b7a6f]">
            {who}
            {meta ? ` · ${meta}` : ''}
          </span>
        </span>

        {right}

        <span
          className={`shrink-0 text-[13px] text-[#9aa89d] transition-transform ${
            open ? 'rotate-90' : ''
          }`}
        >
          ›
        </span>
      </button>

      {open && <div className="border-t border-[#eef2ea] px-4 py-4">{children}</div>}
    </article>
  );
}

/* ------------------------------------------------------------ topshiriqlar */

function ChallengeQueue({ onDone, onError }) {
  const { items, loading, reload } = useQueue('/challenges/admin/list');
  const [filter, setFilter] = useState('pending');
  const [open, setOpen] = useState(null);
  const [armed, setArmed] = useState(null);
  const [busy, setBusy] = useState(false);

  const counts = {
    pending: items.filter((i) => i.status === 'pending').length,
    approved: items.filter((i) => i.status === 'approved').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
  };

  const shown = items.filter((i) => i.status === filter);

  async function review(item, status) {
    setBusy(true);
    try {
      const res = await api.post(`/challenges/admin/${item.id}/review`, { status });
      setArmed(null);
      setOpen(null);
      await reload();
      onDone(res.message);
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }

  return (
    <QueueShell
      filter={filter}
      setFilter={setFilter}
      counts={counts}
      loading={loading}
      empty={
        <EmptyState
          title={
            filter === 'pending'
              ? 'Navbat bo‘sh — hammasi ko‘rib chiqilgan.'
              : 'Bu bo‘limda hozircha yozuv yo‘q.'
          }
          hint={
            filter === 'pending'
              ? 'Yangi topshiriq kelganda shu yerda paydo bo‘ladi va yuqoridagi raqam o‘zgaradi.'
              : null
          }
        />
      }
    >
      {shown.length > 0 ? (
        <div className="space-y-2">
          {shown.map((item) => (
            <QueueRow
              key={item.id}
              open={open === item.id}
              onToggle={() => {
                setOpen(open === item.id ? null : item.id);
                setArmed(null);
              }}
              status={item.status}
              title={item.challenge_title || 'Challenge'}
              who={item.full_name || 'Noma’lum o‘quvchi'}
              klass={item.class_name}
              meta={shortDate(item.submitted_at)}
              right={
                <span className="shrink-0 text-[14px] font-semibold tabular-nums text-[#2f5d3a]">
                  +{item.challenge_points ?? 0}
                </span>
              }
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="min-w-0 max-w-xl flex-1">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[#9aa89d]">
                    O‘quvchi izohi
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-6 text-[#30402f]">
                    {item.proof_text || 'Izoh kiritilmagan.'}
                  </p>
                </div>

                {item.proof_url && (
                  <a
                    href={fileUrl(item.proof_url, true)}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full shrink-0 sm:w-56"
                  >
                    <img
                      src={fileUrl(item.proof_url, true)}
                      alt="Topshiriq dalili"
                      onError={(e) => {
                        e.currentTarget.parentElement.style.display = 'none';
                      }}
                      className="max-h-56 w-full rounded-lg border border-[#e8ede3] object-cover"
                    />
                    <span className="mt-1.5 block text-[12px] text-[#6b7a6f] underline">
                      Kattalashtirib ko‘rish
                    </span>
                  </a>
                )}
              </div>

              {item.status === 'pending' ? (
                <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-[#eef2ea] pt-4">
                  <ConfirmAction
                    tone="red"
                    idle="Rad etish"
                    question="Rad etilsinmi?"
                    armed={armed === `r${item.id}`}
                    busy={busy}
                    onArm={() => setArmed(`r${item.id}`)}
                    onCancel={() => setArmed(null)}
                    onConfirm={() => review(item, 'rejected')}
                  />
                  <ConfirmAction
                    idle={`Tasdiqlash · +${item.challenge_points ?? 0} ball`}
                    question={`+${item.challenge_points ?? 0} ball berilsinmi?`}
                    armed={armed === `a${item.id}`}
                    busy={busy}
                    onArm={() => setArmed(`a${item.id}`)}
                    onCancel={() => setArmed(null)}
                    onConfirm={() => review(item, 'approved')}
                  />
                </div>
              ) : (
                <p className="mt-4 border-t border-[#eef2ea] pt-4 text-[13px] text-[#6b7a6f]">
                  {statusOf(item.status).label}
                  {item.awarded_points > 0 && ` · ${item.awarded_points} ball berilgan`}
                </p>
              )}
            </QueueRow>
          ))}
        </div>
      ) : null}
    </QueueShell>
  );
}

/* -------------------------------------------------------------- recycling */

function RecyclingQueue({ onDone, onError }) {
  const { items, loading, reload } = useQueue('/recycling/admin/list');
  const [filter, setFilter] = useState('pending');
  const [open, setOpen] = useState(null);
  const [weights, setWeights] = useState({});
  const [armed, setArmed] = useState(null);
  const [busy, setBusy] = useState(false);

  const counts = {
    pending: items.filter((i) => i.status === 'pending').length,
    approved: items.filter((i) => i.status === 'approved').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
  };

  const shown = items.filter((i) => i.status === filter);

  async function review(item, status) {
    const verified = Number(weights[item.id] ?? item.amount_kg);

    if (status === 'approved' && (!Number.isFinite(verified) || verified <= 0)) {
      onError('Haqiqiy vaznni kiriting.');
      return;
    }

    setBusy(true);
    try {
      const res = await api.post(`/recycling/admin/${item.id}/review`, {
        status,
        ...(status === 'approved' ? { verifiedAmountKg: verified } : {}),
      });
      setArmed(null);
      setOpen(null);
      await reload();
      onDone(res.message);
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }

  return (
    <QueueShell
      filter={filter}
      setFilter={setFilter}
      counts={counts}
      loading={loading}
      empty={
        <EmptyState
          title={
            filter === 'pending'
              ? 'Tarozi navbati bo‘sh.'
              : 'Bu bo‘limda hozircha yozuv yo‘q.'
          }
          hint={
            filter === 'pending'
              ? 'Ball tarozidagi haqiqiy vazn bo‘yicha beriladi, o‘quvchi yozgan raqam bo‘yicha emas.'
              : null
          }
        />
      }
    >
      {shown.length > 0 ? (
        <div className="space-y-2">
          {shown.map((item) => (
            <QueueRow
              key={item.id}
              open={open === item.id}
              onToggle={() => {
                setOpen(open === item.id ? null : item.id);
                setArmed(null);
              }}
              status={item.status}
              title={`${MATERIAL[item.material] || item.material} · ${item.amount_kg} kg`}
              who={item.full_name || 'Noma’lum o‘quvchi'}
              klass={item.class_name}
              meta={shortDate(item.submitted_at)}
              right={
                item.status === 'approved' ? (
                  <span className="shrink-0 text-[14px] font-semibold tabular-nums text-[#2f5d3a]">
                    +{item.awarded_points}
                  </span>
                ) : null
              }
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="min-w-0 max-w-xl flex-1">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[#9aa89d]">
                    O‘quvchi ko‘rsatgan vazn
                  </p>
                  <p className="mt-2 text-[22px] font-bold tabular-nums">
                    {item.amount_kg} kg
                    <span className="ml-2 text-[14px] font-normal text-[#6b7a6f]">
                      {MATERIAL[item.material] || item.material}
                    </span>
                  </p>

                  {item.status === 'pending' && (
                    <label className="mt-5 block">
                      <span className="block text-[13px] font-medium text-[#30402f]">
                        Tarozidagi haqiqiy vazn
                      </span>
                      <span className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          inputMode="decimal"
                          value={weights[item.id] ?? item.amount_kg}
                          onChange={(e) =>
                            setWeights({ ...weights, [item.id]: e.target.value })
                          }
                          className="w-32 rounded-lg border border-[#d6ded1] px-3 py-2 text-[15px] tabular-nums outline-none focus:border-[#2f5d3a]"
                        />
                        <span className="text-[14px] text-[#6b7a6f]">kg</span>
                      </span>
                      <span className="mt-2 block text-[12px] text-[#6b7a6f]">
                        Ball shu raqam bo‘yicha hisoblanadi.
                      </span>
                    </label>
                  )}

                  {item.status === 'approved' && (
                    <p className="mt-4 text-[13px] text-[#6b7a6f]">
                      Tasdiqlangan vazn:{' '}
                      <b className="text-[#1f2b22]">{item.verified_amount_kg} kg</b>
                    </p>
                  )}
                </div>

                {item.proof_image && (
                  <a
                    href={fileUrl(item.proof_image, true)}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full shrink-0 sm:w-56"
                  >
                    <img
                      src={fileUrl(item.proof_image, true)}
                      alt="Tarozi surati"
                      onError={(e) => {
                        e.currentTarget.parentElement.style.display = 'none';
                      }}
                      className="max-h-56 w-full rounded-lg border border-[#e8ede3] object-cover"
                    />
                    <span className="mt-1.5 block text-[12px] text-[#6b7a6f] underline">
                      Kattalashtirib ko‘rish
                    </span>
                  </a>
                )}
              </div>

              {item.status === 'pending' && (
                <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-[#eef2ea] pt-4">
                  <ConfirmAction
                    tone="red"
                    idle="Rad etish"
                    question="Rad etilsinmi?"
                    armed={armed === `r${item.id}`}
                    busy={busy}
                    onArm={() => setArmed(`r${item.id}`)}
                    onCancel={() => setArmed(null)}
                    onConfirm={() => review(item, 'rejected')}
                  />
                  <ConfirmAction
                    idle="Tasdiqlash"
                    question={`${weights[item.id] ?? item.amount_kg} kg bo‘yicha ball berilsinmi?`}
                    armed={armed === `a${item.id}`}
                    busy={busy}
                    onArm={() => setArmed(`a${item.id}`)}
                    onCancel={() => setArmed(null)}
                    onConfirm={() => review(item, 'approved')}
                  />
                </div>
              )}
            </QueueRow>
          ))}
        </div>
      ) : null}
    </QueueShell>
  );
}

/* -------------------------------------------------------------- tadqiqot */

function ResearchNote() {
  return (
    <EmptyState
      title="Tadqiqotlar o‘z sahifasida baholanadi"
      hint="U yerda tadqiqot matnini to‘liq o‘qib, 0–40 oralig‘ida ball qo‘yasiz va izoh yozasiz."
    />
  );
}

/* ------------------------------------------------------------ foydalanuvchilar */

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', student: 'O‘quvchi' };

function UserList({ isOwner, onDone, onError }) {
  const [data, setData] = useState({ users: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [armed, setArmed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ fullName: '', username: '', password: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (role) params.set('role', role);
      if (q.trim()) params.set('q', q.trim());
      setData(await api.get(`/users${params.toString() ? `?${params}` : ''}`));
    } catch (err) {
      onError(err.message);
    }
    setLoading(false);
  }, [role, q, onError]);

  useEffect(() => {
    const timer = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  async function changeRole(u, next) {
    setBusy(true);
    try {
      const res = await api.post(`/users/${u.id}/role`, { role: next });
      setArmed(null);
      await load();
      onDone(res.message);
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }

  async function createAdmin(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/users', {
        fullName: form.fullName,
        username: form.username,
        role: 'admin',
        ...(form.password.trim() ? { password: form.password.trim() } : {}),
      });
      setForm({ fullName: '', username: '', password: '' });
      setAdding(false);
      setTemp(res);
      await load();
      // Xabar pastdagi parol qutisida turibdi — tepada takrorlanmasin
      onDone('');
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }

  async function resetPassword(u) {
    setBusy(true);
    try {
      const res = await api.post(`/users/${u.id}/reset-password`, {});
      setArmed(null);
      setTemp(res);
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented
          value={role}
          onChange={setRole}
          options={[
            { value: '', label: 'Hammasi', count: data.counts?.all },
            { value: 'admin', label: 'Adminlar', count: data.counts?.admins },
            { value: 'student', label: 'O‘quvchilar', count: data.counts?.students },
          ]}
        />

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ism yoki login bo‘yicha qidirish"
          className="min-w-[200px] flex-1 rounded-xl border border-[#d6ded1] bg-white px-4 py-2 text-[14px] outline-none placeholder:text-[#9aa89d] focus:border-[#2f5d3a]"
        />

        {isOwner && !adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setTemp(null);
            }}
            className="shrink-0 rounded-xl bg-[#2f5d3a] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#285032]"
          >
            Admin qo‘shish
          </button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={createAdmin}
          className="mb-5 rounded-xl border border-[#e8ede3] bg-white px-5 py-5"
        >
          <h3 className="text-[15px] font-bold">Yangi admin</h3>
          <p className="mt-1.5 text-[13px] leading-6 text-[#6b7a6f]">
            Hisobi yo‘q o‘qituvchi uchun. Parolni bo‘sh qoldirsangiz, tizim o‘zi
            yaratadi va bir marta ko‘rsatadi.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="block text-[13px] font-medium text-[#30402f]">Ism va familiya</span>
              <input
                required
                minLength={3}
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Nodira Usmonova"
                className="mt-2 w-full rounded-lg border border-[#d6ded1] px-3 py-2 text-[14px] outline-none placeholder:text-[#c2cbbe] focus:border-[#2f5d3a]"
              />
            </label>

            <label className="block">
              <span className="block text-[13px] font-medium text-[#30402f]">Login</span>
              <input
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="n.usmonova"
                className="mt-2 w-full rounded-lg border border-[#d6ded1] px-3 py-2 text-[14px] outline-none placeholder:text-[#c2cbbe] focus:border-[#2f5d3a]"
              />
              <span className="mt-1.5 block text-[12px] text-[#9aa89d]">
                Kichik harf, raqam, _ va .
              </span>
            </label>

            <label className="block">
              <span className="block text-[13px] font-medium text-[#30402f]">
                Parol <span className="font-normal text-[#9aa89d]">— ixtiyoriy</span>
              </span>
              <input
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Avtomatik yaratilsin"
                className="mt-2 w-full rounded-lg border border-[#d6ded1] px-3 py-2 text-[14px] outline-none placeholder:text-[#c2cbbe] focus:border-[#2f5d3a]"
              />
              <span className="mt-1.5 block text-[12px] text-[#9aa89d]">Kamida 8 ta belgi</span>
            </label>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#2f5d3a] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#285032] disabled:opacity-50"
            >
              {busy ? 'Qo‘shilmoqda...' : 'Qo‘shish'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-[14px] text-[#6b7a6f] hover:text-[#1f2b22]"
            >
              Bekor qilish
            </button>
          </div>
        </form>
      )}

      {temp && (
        <div className="mb-5 rounded-xl border border-[#cfe0cb] bg-[#ecf3ea] px-5 py-4">
          <p className="text-[14px] font-semibold text-[#2f5d3a]">{temp.message}</p>
          <p className="mt-3 text-[14px] text-[#30402f]">
            Login: <b>{temp.username}</b> ·{' '}
            {temp.generated === false ? 'Parol' : 'Vaqtinchalik parol'}:{' '}
            <b className="rounded-md bg-white px-2 py-0.5 font-mono">{temp.password}</b>
          </p>
          <p className="mt-2 text-[12px] text-[#6b7a6f]">
            Bu parol faqat hozir ko‘rinadi — boshqa hech qayerda saqlanmaydi. Egasiga
            aytib, birinchi kirishdan keyin almashtirishni so‘rang.
          </p>
          <button
            type="button"
            onClick={() => setTemp(null)}
            className="mt-3 text-[13px] font-medium text-[#2f5d3a] underline"
          >
            Yopish
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[58px] animate-pulse rounded-xl bg-white/70" />
          ))}
        </div>
      ) : data.users.length === 0 ? (
        <EmptyState title="Hech kim topilmadi" hint="Qidiruv so‘zini yoki filtrni o‘zgartiring." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e8ede3] bg-white">
          <div className="hidden items-center gap-x-3 border-b border-[#e8ede3] bg-[#fafbf8] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-[#9aa89d] sm:flex">
            <span className="w-[84px] shrink-0">Sinf</span>
            <span className="min-w-0 flex-1">O‘quvchi</span>
            <span className="w-16 shrink-0 text-right">Ball</span>
            <span className="w-24 shrink-0 text-center">Rol</span>
            {isOwner && <span className="w-[260px] shrink-0" />}
          </div>

          {data.users.map((u, i) => (
            <div
              key={u.id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-[#fafbf8] ${
                i > 0 ? 'border-t border-[#f0f3ed]' : ''
              }`}
            >
              <span className="w-[84px] shrink-0">
                <ClassTag>{u.class_name}</ClassTag>
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{u.full_name}</span>
                <span className="block truncate text-[13px] text-[#6b7a6f]">
                  @{u.username}
                  {u.telegram_linked ? ' · Telegram' : ''}
                </span>
              </span>

              <span className="w-16 shrink-0 text-right text-[14px] font-semibold tabular-nums">
                {u.points}
              </span>

              <span className="w-24 shrink-0 text-center">
                <span
                  className={`inline-block rounded-md px-2 py-1 text-[12px] font-semibold ${
                    u.role === 'owner'
                      ? 'bg-[#efeadf] text-[#7a6322]'
                      : u.role === 'admin'
                        ? 'bg-[#ecf3ea] text-[#2f5d3a]'
                        : 'text-[#9aa89d]'
                  }`}
                >
                  {ROLE_LABEL[u.role]}
                </span>
              </span>

              {isOwner && (
                <span className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1 sm:w-[260px]">
                  {u.role !== 'owner' && (
                    <>
                      <ConfirmAction
                        quiet
                        idle={u.role === 'admin' ? 'Adminlikdan olish' : 'Admin qilish'}
                        question="Aniqmi?"
                        tone={u.role === 'admin' ? 'red' : 'green'}
                        armed={armed === `role${u.id}`}
                        busy={busy}
                        onArm={() => setArmed(`role${u.id}`)}
                        onCancel={() => setArmed(null)}
                        onConfirm={() => changeRole(u, u.role === 'admin' ? 'student' : 'admin')}
                      />
                      {armed !== `role${u.id}` && (
                        <ConfirmAction
                          quiet
                          idle="Parolni tiklash"
                          question="Yangi parol berilsinmi?"
                          tone="red"
                          armed={armed === `pass${u.id}`}
                          busy={busy}
                          onArm={() => setArmed(`pass${u.id}`)}
                          onCancel={() => setArmed(null)}
                          onConfirm={() => resetPassword(u)}
                        />
                      )}
                    </>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {!isOwner && (
        <p className="mt-5 text-[13px] leading-6 text-[#6b7a6f]">
          Rol o‘zgartirish va parol tiklash faqat owner qo‘lida — shuning uchun Eco Team
          tarkibi tasodifan o‘zgarib ketmaydi.
        </p>
      )}
    </>
  );
}

/* ------------------------------------------------------------ vazifalar */

const EMPTY_TASK = { title: '', description: '', category: 'UMUMIY', points: 30, endDate: '' };

function ChallengeAdmin({ onDone, onError }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null | EMPTY_TASK | mavjud vazifa
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/challenges/admin/challenges');
      setItems(data.challenges || []);
    } catch (err) {
      onError(err.message);
    }
    setLoading(false);
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        points: Number(form.points),
        endDate: form.endDate || null,
      };

      const res = form.id
        ? await api.put(`/challenges/admin/challenges/${form.id}`, payload)
        : await api.post('/challenges/admin/challenges', payload);

      setForm(null);
      await load();
      onDone(res.message);
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }

  async function remove(item) {
    setBusy(true);
    try {
      const res = await api.del(`/challenges/admin/challenges/${item.id}`);
      setArmed(null);
      await load();
      onDone(res.message);
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-[#6b7a6f]">
          Yangi vazifa qo‘shilganda botga ulangan o‘quvchilarga darhol xabar ketadi.
        </p>
        {!form && (
          <button
            type="button"
            onClick={() => setForm({ ...EMPTY_TASK })}
            className="shrink-0 rounded-xl bg-[#2f5d3a] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#285032]"
          >
            Yangi vazifa
          </button>
        )}
      </div>

      {form && (
        <form onSubmit={save} className="mb-5 rounded-xl border border-[#e8ede3] bg-white px-5 py-5">
          <h3 className="text-[15px] font-bold">
            {form.id ? 'Vazifani tahrirlash' : 'Yangi vazifa'}
          </h3>

          <label className="mt-5 block">
            <span className="block text-[13px] font-medium text-[#30402f]">Sarlavha</span>
            <input
              required
              minLength={3}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Plastiksiz bir hafta"
              className="mt-2 w-full rounded-lg border border-[#d6ded1] px-3 py-2 text-[14px] outline-none placeholder:text-[#c2cbbe] focus:border-[#2f5d3a]"
            />
          </label>

          <label className="mt-4 block">
            <span className="block text-[13px] font-medium text-[#30402f]">
              Tavsif <span className="font-normal text-[#9aa89d]">— nima qilish kerakligi</span>
            </span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Bir hafta davomida bir martalik plastikdan voz keching va buni rasmga oling."
              className="mt-2 w-full resize-y rounded-lg border border-[#d6ded1] px-3 py-2 text-[14px] leading-6 outline-none placeholder:text-[#c2cbbe] focus:border-[#2f5d3a]"
            />
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="block text-[13px] font-medium text-[#30402f]">Turkum</span>
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="UMUMIY"
                className="mt-2 w-full rounded-lg border border-[#d6ded1] px-3 py-2 text-[14px] uppercase outline-none focus:border-[#2f5d3a]"
              />
            </label>

            <label className="block">
              <span className="block text-[13px] font-medium text-[#30402f]">Ball</span>
              <input
                type="number"
                min="1"
                max="500"
                required
                value={form.points}
                onChange={(e) => setForm({ ...form, points: e.target.value })}
                className="mt-2 w-full rounded-lg border border-[#d6ded1] px-3 py-2 text-[14px] tabular-nums outline-none focus:border-[#2f5d3a]"
              />
            </label>

            <label className="block">
              <span className="block text-[13px] font-medium text-[#30402f]">
                Tugash sanasi <span className="font-normal text-[#9aa89d]">— ixtiyoriy</span>
              </span>
              <input
                type="date"
                value={form.endDate || ''}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="mt-2 w-full rounded-lg border border-[#d6ded1] px-3 py-2 text-[14px] outline-none focus:border-[#2f5d3a]"
              />
            </label>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#2f5d3a] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#285032] disabled:opacity-50"
            >
              {busy ? 'Saqlanmoqda...' : form.id ? 'Saqlash' : 'Qo‘shish va xabar berish'}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="text-[14px] text-[#6b7a6f] hover:text-[#1f2b22]"
            >
              Bekor qilish
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[62px] animate-pulse rounded-xl bg-white/70" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Hali vazifa yo‘q"
          hint="«Yangi vazifa» tugmasi bilan birinchisini qo‘shing — u saytda ham, botda ham ko‘rinadi."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e8ede3] bg-white">
          {items.map((item, i) => (
            <div
              key={item.id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 hover:bg-[#fafbf8] ${
                i > 0 ? 'border-t border-[#f0f3ed]' : ''
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{item.title}</span>
                <span className="block truncate text-[13px] text-[#6b7a6f]">
                  {item.category}
                  {item.end_date ? ` · ${item.end_date} gacha` : ''}
                  {item.submissions > 0 ? ` · ${item.submissions} ta topshiriq` : ''}
                </span>
              </span>

              <span className="shrink-0 text-[14px] font-semibold tabular-nums text-[#2f5d3a]">
                +{item.points}
              </span>

              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      id: item.id,
                      title: item.title,
                      description: item.description || '',
                      category: item.category,
                      points: item.points,
                      endDate: item.end_date || '',
                    })
                  }
                  className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-[#2f5d3a] hover:bg-[#ecf3ea]"
                >
                  Tahrirlash
                </button>

                {item.submissions === 0 && (
                  <ConfirmAction
                    quiet
                    tone="red"
                    idle="O‘chirish"
                    question="O‘chirilsinmi?"
                    armed={armed === item.id}
                    busy={busy}
                    onArm={() => setArmed(item.id)}
                    onCancel={() => setArmed(null)}
                    onConfirm={() => remove(item)}
                  />
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------- marafon */

const EMPTY_MARATHON = {
  title: '',
  description: '',
  days: 30,
  pointsPerDay: 10,
  bonusPoints: 100,
  startDate: new Date().toISOString().slice(0, 10),
  dayTasks: '',
};

function MarathonAdmin({ onDone, onError }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/admin/marathons');
      setItems(data.marathons || []);
    } catch (err) {
      onError(err.message);
    }
    setLoading(false);
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  async function edit(item) {
    setBusy(true);
    try {
      const data = await api.get(`/admin/marathons/${item.id}`);
      setForm({
        id: item.id,
        title: data.marathon.title,
        description: data.marathon.description || '',
        days: data.marathon.days,
        pointsPerDay: data.marathon.points_per_day,
        bonusPoints: data.marathon.bonus_points,
        startDate: data.marathon.start_date,
        dayTasks: (data.days || []).map((d) => d.title).join('\n'),
      });
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        days: Number(form.days),
        pointsPerDay: Number(form.pointsPerDay),
        bonusPoints: Number(form.bonusPoints),
        startDate: form.startDate,
        dayTasks: form.dayTasks,
      };

      const res = form.id
        ? await api.put(`/admin/marathons/${form.id}`, payload)
        : await api.post('/admin/marathons', payload);

      setForm(null);
      await load();
      onDone(res.message);
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }

  async function finish(item) {
    setBusy(true);
    try {
      const res = await api.post(`/admin/marathons/${item.id}/finish`, {});
      setArmed(null);
      await load();
      onDone(res.message);
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }

  const lines = form ? form.dayTasks.split('\n').filter((l) => l.trim()).length : 0;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[14px] leading-6 text-[#6b7a6f]">
          Marafon — ko‘p kunlik challenge. E’lon qilinganda botga ulangan o‘quvchilarga
          «Qo‘shilaman» tugmasi bilan xabar ketadi, keyin har kuni o‘sha kunning vazifasi
          eslatiladi.
        </p>
        {!form && (
          <button
            type="button"
            onClick={() => setForm({ ...EMPTY_MARATHON })}
            className="shrink-0 rounded-xl bg-[#2f5d3a] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#285032]"
          >
            Yangi marafon
          </button>
        )}
      </div>

      {form && (
        <form onSubmit={save} className="mb-5 rounded-xl border border-[#e8ede3] bg-white px-5 py-5">
          <h3 className="text-[15px] font-bold">
            {form.id ? 'Marafonni tahrirlash' : 'Yangi marafon'}
          </h3>

          <label className="mt-5 block">
            <span className="block text-[13px] font-medium text-[#30402f]">Sarlavha</span>
            <input
              required
              minLength={3}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="30 kunlik eko-marafon"
              className="mt-2 w-full rounded-lg border border-[#d6ded1] px-3 py-2 text-[14px] outline-none placeholder:text-[#c2cbbe] focus:border-[#2f5d3a]"
            />
          </label>

          <label className="mt-4 block">
            <span className="block text-[13px] font-medium text-[#30402f]">Tavsif</span>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Har kuni bitta kichik eko-qadam. Oson emas, davomiylik muhim."
              className="mt-2 w-full resize-y rounded-lg border border-[#d6ded1] px-3 py-2 text-[14px] leading-6 outline-none placeholder:text-[#c2cbbe] focus:border-[#2f5d3a]"
            />
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <label className="block">
              <span className="block text-[13px] font-medium text-[#30402f]">Kunlar</span>
              <input
                type="number"
                min="2"
                max="100"
                required
                value={form.days}
                onChange={(e) => setForm({ ...form, days: e.target.value })}
                className="mt-2 w-full rounded-lg border border-[#d6ded1] px-3 py-2 text-[14px] tabular-nums outline-none focus:border-[#2f5d3a]"
              />
            </label>

            <label className="block">
              <span className="block text-[13px] font-medium text-[#30402f]">Kunlik ball</span>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={form.pointsPerDay}
                onChange={(e) => setForm({ ...form, pointsPerDay: e.target.value })}
                className="mt-2 w-full rounded-lg border border-[#d6ded1] px-3 py-2 text-[14px] tabular-nums outline-none focus:border-[#2f5d3a]"
              />
            </label>

            <label className="block">
              <span className="block text-[13px] font-medium text-[#30402f]">Bonus</span>
              <input
                type="number"
                min="0"
                max="1000"
                value={form.bonusPoints}
                onChange={(e) => setForm({ ...form, bonusPoints: e.target.value })}
                className="mt-2 w-full rounded-lg border border-[#d6ded1] px-3 py-2 text-[14px] tabular-nums outline-none focus:border-[#2f5d3a]"
              />
              <span className="mt-1.5 block text-[12px] text-[#9aa89d]">Hammasi uchun</span>
            </label>

            <label className="block">
              <span className="block text-[13px] font-medium text-[#30402f]">Boshlanish</span>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="mt-2 w-full rounded-lg border border-[#d6ded1] px-3 py-2 text-[14px] outline-none focus:border-[#2f5d3a]"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="block text-[13px] font-medium text-[#30402f]">
              Kunlik vazifalar{' '}
              <span className="font-normal text-[#9aa89d]">— har qatorda bitta, tartib bilan</span>
            </span>
            <textarea
              rows={8}
              value={form.dayTasks}
              onChange={(e) => setForm({ ...form, dayTasks: e.target.value })}
              placeholder={
                'Bugun bitta plastik paketdan voz keching\n' +
                'Jo‘mrakni yopib tish yuving\n' +
                'Keraksiz chiroqlarni o‘chiring\n' +
                '...'
              }
              className="mt-2 w-full resize-y rounded-lg border border-[#d6ded1] px-3 py-2 font-mono text-[13px] leading-6 outline-none placeholder:text-[#c2cbbe] focus:border-[#2f5d3a]"
            />
            <span className="mt-1.5 block text-[12px] text-[#9aa89d]">
              {lines} ta qator / {form.days} kun
              {lines > 0 && lines < Number(form.days)
                ? ' — yetmagan kunlarda tavsif matni ishlatiladi'
                : ''}
            </span>
          </label>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#2f5d3a] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#285032] disabled:opacity-50"
            >
              {busy ? 'Saqlanmoqda...' : form.id ? 'Saqlash' : 'E’lon qilish'}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="text-[14px] text-[#6b7a6f] hover:text-[#1f2b22]"
            >
              Bekor qilish
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-xl bg-white/70" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Hali marafon yo‘q"
          hint="«Yangi marafon» bilan birinchisini e’lon qiling — 30 kunlik bo‘lishi shart emas."
        />
      ) : (
        <div className="space-y-2">
          {items.map((m) => (
            <div key={m.id} className="rounded-xl border border-[#e8ede3] bg-white px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{m.title}</span>
                  <span className="block truncate text-[13px] text-[#6b7a6f]">
                    {m.days} kun · +{m.points_per_day}/kun · {m.start_date} dan
                    {m.participants > 0 ? ` · ${m.participants} ishtirokchi` : ''}
                    {m.checkins > 0 ? ` · ${m.checkins} belgilash` : ''}
                  </span>
                </span>

                <span
                  className={`shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold ${
                    m.status === 'active'
                      ? 'bg-[#ecf3ea] text-[#2f5d3a]'
                      : 'bg-[#f1f3ef] text-[#6b7a6f]'
                  }`}
                >
                  {m.status === 'active'
                    ? m.today < 1
                      ? 'boshlanmagan'
                      : m.today > m.days
                        ? 'muddati tugadi'
                        : `${m.today}/${m.days}-kun`
                    : 'yakunlangan'}
                </span>

                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => edit(m)}
                    className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-[#2f5d3a] hover:bg-[#ecf3ea]"
                  >
                    Tahrirlash
                  </button>

                  {m.status === 'active' && (
                    <ConfirmAction
                      quiet
                      tone="red"
                      idle="Yakunlash"
                      question="Yakunlansinmi?"
                      armed={armed === m.id}
                      busy={busy}
                      onArm={() => setArmed(m.id)}
                      onCancel={() => setArmed(null)}
                      onConfirm={() => finish(m)}
                    />
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------- e'lonlar */

function AnnouncementAdmin({ isOwner, onDone, onError }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/admin/announcements');
      setItems(data.announcements || []);
    } catch (err) {
      onError(err.message);
    }
    setLoading(false);
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/admin/announcements', {
        title: form.title,
        body: form.body,
        link: form.link || null,
        pinned: form.pinned,
        toBot: form.toBot,
      });
      setForm(null);
      await load();
      onDone(res.message);
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }

  async function togglePin(item) {
    setBusy(true);
    try {
      const res = await api.post(`/admin/announcements/${item.id}/pin`, { pinned: !item.pinned });
      await load();
      onDone(res.message);
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }

  async function remove(item) {
    setBusy(true);
    try {
      const res = await api.del(`/admin/announcements/${item.id}`);
      setArmed(null);
      await load();
      onDone(res.message);
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[14px] leading-6 text-[#6b7a6f]">
          E’lon saytning tepasida chiziq bo‘lib turadi va botga ulanganlarga xabar
          bo‘lib boradi. O‘quvchi yopsa, qaytib ko‘rinmaydi — yangi e’lon chiqqunicha.
        </p>
        {isOwner && !form && (
          <button
            type="button"
            onClick={() =>
              setForm({ title: '', body: '', link: '', pinned: true, toBot: true })
            }
            className="shrink-0 rounded-xl bg-[#2f5d3a] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#285032]"
          >
            Yangi e’lon
          </button>
        )}
      </div>

      {form && (
        <form onSubmit={send} className="mb-5 rounded-xl border border-[#e8ede3] bg-white px-5 py-5">
          <h3 className="text-[15px] font-bold">Yangi e’lon</h3>

          <label className="mt-5 block">
            <span className="block text-[13px] font-medium text-[#30402f]">Sarlavha</span>
            <input
              required
              minLength={3}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Shanba kuni hashar bor"
              className="mt-2 w-full rounded-lg border border-[#d6ded1] px-3 py-2 text-[14px] outline-none placeholder:text-[#c2cbbe] focus:border-[#2f5d3a]"
            />
          </label>

          <label className="mt-4 block">
            <span className="block text-[13px] font-medium text-[#30402f]">Matn</span>
            <textarea
              rows={3}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Soat 9:00 da maktab hovlisida yig‘ilamiz. Qo‘lqop va paket olib keling."
              className="mt-2 w-full resize-y rounded-lg border border-[#d6ded1] px-3 py-2 text-[14px] leading-6 outline-none placeholder:text-[#c2cbbe] focus:border-[#2f5d3a]"
            />
          </label>

          <label className="mt-4 block">
            <span className="block text-[13px] font-medium text-[#30402f]">
              Havola <span className="font-normal text-[#9aa89d]">— ixtiyoriy</span>
            </span>
            <input
              type="url"
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="https://..."
              className="mt-2 w-full rounded-lg border border-[#d6ded1] px-3 py-2 text-[14px] outline-none placeholder:text-[#c2cbbe] focus:border-[#2f5d3a]"
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                checked={form.toBot}
                onChange={(e) => setForm({ ...form, toBot: e.target.checked })}
                className="h-4 w-4 accent-[#2f5d3a]"
              />
              Botga ham yuborilsin
            </label>

            <label className="flex items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                className="h-4 w-4 accent-[#2f5d3a]"
              />
              Saytda banner bo‘lib tursin
            </label>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#2f5d3a] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#285032] disabled:opacity-50"
            >
              {busy ? 'Yuborilmoqda...' : 'Yuborish'}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="text-[14px] text-[#6b7a6f] hover:text-[#1f2b22]"
            >
              Bekor qilish
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-[66px] animate-pulse rounded-xl bg-white/70" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Hali e’lon yo‘q"
          hint={
            isOwner
              ? 'Tadbir, hashar yoki muhim xabar bo‘lsa shu yerdan e’lon qiling.'
              : 'E’lonni owner yozadi.'
          }
        />
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <div key={a.id} className="rounded-xl border border-[#e8ede3] bg-white px-4 py-3.5">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{a.title}</span>
                  {a.body && (
                    <span className="mt-0.5 block whitespace-pre-wrap text-[13px] leading-6 text-[#6b7a6f]">
                      {a.body}
                    </span>
                  )}
                  <span className="mt-1 block text-[12px] text-[#9aa89d]">
                    {shortDate(a.created_at)}
                    {a.author ? ` · ${a.author}` : ''}
                    {a.sent_count > 0 ? ` · botda ${a.sent_count} kishiga` : ''}
                  </span>
                </span>

                {a.pinned ? (
                  <span className="shrink-0 rounded-md bg-[#ecf3ea] px-2 py-1 text-[12px] font-semibold text-[#2f5d3a]">
                    bannerda
                  </span>
                ) : null}

                {isOwner && (
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => togglePin(a)}
                      className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-[#2f5d3a] hover:bg-[#ecf3ea] disabled:opacity-50"
                    >
                      {a.pinned ? 'Bannerdan olish' : 'Bannerga qo‘yish'}
                    </button>
                    <ConfirmAction
                      quiet
                      tone="red"
                      idle="O‘chirish"
                      question="O‘chirilsinmi?"
                      armed={armed === a.id}
                      busy={busy}
                      onArm={() => setArmed(a.id)}
                      onCancel={() => setArmed(null)}
                      onConfirm={() => remove(a)}
                    />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
