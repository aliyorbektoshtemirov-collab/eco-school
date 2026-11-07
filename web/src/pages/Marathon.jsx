import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { haptic } from '../lib/telegram';

/**
 * Marafon — ko'p kunlik challenge.
 *
 * Asosiy ko'rinish — kunlar panjarasi: qaysi kun bajarilgan, bugun qaysi
 * kun, qaysilari hali kelmagan. Bir qarashda ko'rinadi.
 */

export default function MarathonPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api.get('/marathons'));
    } catch (err) {
      if (err.status === 401) navigate('/login');
      else setError(err.message);
    }
  }, [navigate]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login', { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function join(m) {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/marathons/${m.id}/join`, {});
      setMessage(res.message);
      await load();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function check(m, day) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post(`/marathons/${m.id}/checkin`, { day });
      setMessage(res.message + (res.streak > 1 ? ` · Ketma-ket ${res.streak} kun 🔥` : ''));
      haptic('success');
      await load();
    } catch (err) {
      setError(err.message);
      haptic('error');
    }
    setBusy(false);
  }

  if (authLoading || !data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f5ef]">
        <p className="text-[14px] text-[#6b7a6f]">Yuklanmoqda...</p>
      </main>
    );
  }

  const active = data.marathons.filter((m) => m.status === 'active');
  const past = data.marathons.filter((m) => m.status !== 'active');

  return (
    <main className="min-h-screen bg-[#f3f5ef] pb-20 text-[#1f2b22]">
      <div className="mx-auto max-w-3xl px-5 pt-6">
        <Link to="/" className="text-[14px] text-[#6b7a6f] hover:text-[#1f2b22]">
          ← Bosh sahifa
        </Link>

        <h1 className="mt-6 text-[28px] font-bold leading-tight">Marafon</h1>
        <p className="mt-2 max-w-lg text-[14px] leading-6 text-[#6b7a6f]">
          Ko‘p kunlik challenge. Har kuni bitta kichik qadam — har kuni ball.
          Botga ulangan bo‘lsangiz, kunlik eslatma Telegramga ham keladi.
        </p>

        {message && (
          <p className="mt-5 rounded-xl border border-[#cfe0cb] bg-[#ecf3ea] px-4 py-3 text-[14px] text-[#2f5d3a]">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-5 rounded-xl border border-[#e6cfca] bg-[#f9efed] px-4 py-3 text-[14px] text-[#8f4539]">
            {error}
          </p>
        )}

        {active.length === 0 && (
          <div className="mt-7 rounded-2xl border border-dashed border-[#d6ded1] px-6 py-14 text-center">
            <p className="text-[15px] font-medium">Hozir faol marafon yo‘q</p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-[#6b7a6f]">
              Yangisi e’lon qilinganda bu yerda paydo bo‘ladi va botga xabar keladi.
            </p>
          </div>
        )}

        {active.map((m) => (
          <MarathonCard key={m.id} m={m} busy={busy} onJoin={join} onCheck={check} />
        ))}

        {past.length > 0 && (
          <>
            <h2 className="mt-10 text-[15px] font-semibold text-[#6b7a6f]">Tugaganlari</h2>
            {past.map((m) => (
              <MarathonCard key={m.id} m={m} busy={busy} onJoin={join} onCheck={check} />
            ))}
          </>
        )}
      </div>
    </main>
  );
}

function MarathonCard({ m, busy, onJoin, onCheck }) {
  const finished = m.status !== 'active';
  const done = new Set(m.checkins);
  const tasks = new Map(m.dayTasks.map((t) => [t.day_number, t.title]));

  const today = m.today;
  const notStarted = today < 1;
  const over = today > m.days;

  const todayDone = done.has(today);
  const yesterday = today - 1;
  const canFixYesterday = m.joined && !finished && yesterday >= 1 && !done.has(yesterday) && !over;

  const progress = Math.round((done.size / m.days) * 100);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-[#e2e8dd] bg-white">
      <div className="px-6 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[20px] font-bold leading-tight">{m.title}</h2>
            <p className="mt-1.5 text-[13px] text-[#6b7a6f]">
              {m.days} kun · kuniga +{m.points_per_day} ball
              {m.bonus_points > 0 && ` · hammasi uchun +${m.bonus_points}`}
              {m.participants > 0 && ` · ${m.participants} ishtirokchi`}
            </p>
          </div>

          {finished ? (
            <span className="shrink-0 rounded-lg bg-[#f1f3ef] px-3 py-1.5 text-[13px] font-medium text-[#6b7a6f]">
              Tugagan
            </span>
          ) : !m.joined ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onJoin(m)}
              className="shrink-0 rounded-xl bg-[#2f5d3a] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#285032] disabled:opacity-50"
            >
              Qo‘shilaman
            </button>
          ) : (
            <span className="shrink-0 text-right">
              <span className="block text-[20px] font-bold tabular-nums text-[#2f5d3a]">
                {done.size}/{m.days}
              </span>
              <span className="block text-[12px] text-[#9aa89d]">bajarildi</span>
            </span>
          )}
        </div>

        {m.description && (
          <p className="mt-4 whitespace-pre-wrap text-[14px] leading-6 text-[#30402f]">
            {m.description}
          </p>
        )}

        {m.joined && (
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#eef2ea]">
            <div
              className="h-full rounded-full bg-[#2f5d3a] transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Bugungi vazifa */}
      {m.joined && !finished && !notStarted && !over && (
        <div className="mx-6 mt-6 rounded-xl bg-[#f3f6f1] px-5 py-5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6b7a6f]">
            Bugun · {today}-kun
          </p>
          <p className="mt-2 text-[15px] leading-6 text-[#1f2b22]">
            {tasks.get(today) || m.description || 'Bugungi eko-qadamni bajaring.'}
          </p>

          {todayDone ? (
            <p className="mt-4 text-[14px] font-medium text-[#2f5d3a]">
              ✅ Bugungi kun belgilangan
            </p>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onCheck(m, today)}
              className="mt-4 w-full rounded-xl bg-[#2f5d3a] px-5 py-3 text-[15px] font-semibold text-white hover:bg-[#285032] disabled:opacity-50 sm:w-auto"
            >
              {busy ? 'Saqlanmoqda...' : `Bajardim · +${m.points_per_day} ball`}
            </button>
          )}

          {canFixYesterday && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onCheck(m, yesterday)}
              className="mt-3 block text-[13px] text-[#6b7a6f] underline hover:text-[#1f2b22]"
            >
              Kechagi {yesterday}-kunni ham belgilash
            </button>
          )}
        </div>
      )}

      {m.joined && notStarted && (
        <p className="mx-6 mt-6 rounded-xl bg-[#f3f6f1] px-5 py-4 text-[14px] text-[#6b7a6f]">
          Marafon <b className="text-[#1f2b22]">{m.start_date}</b> kuni boshlanadi.
        </p>
      )}

      {/* Kunlar panjarasi */}
      <div className="px-6 pb-6 pt-6">
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: m.days }, (_, i) => i + 1).map((day) => {
            const isDone = done.has(day);
            const isToday = day === today;
            const future = day > today;

            return (
              <span
                key={day}
                title={tasks.get(day) || `${day}-kun`}
                className={`grid h-8 w-8 place-items-center rounded-lg text-[12px] font-semibold tabular-nums ${
                  isDone
                    ? 'bg-[#2f5d3a] text-white'
                    : isToday
                      ? 'bg-white text-[#2f5d3a] ring-2 ring-[#2f5d3a]'
                      : future
                        ? 'bg-[#f3f5ef] text-[#c2cbbe]'
                        : 'bg-[#f9efed] text-[#b08b84]'
                }`}
              >
                {day}
              </span>
            );
          })}
        </div>

        <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-[#9aa89d]">
          <span>
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded bg-[#2f5d3a] align-middle" />
            bajarilgan
          </span>
          <span>
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded bg-[#f9efed] align-middle" />
            o‘tkazib yuborilgan
          </span>
          <span>
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded bg-[#f3f5ef] align-middle" />
            hali kelmagan
          </span>
        </p>
      </div>
    </section>
  );
}
