import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { inTelegram } from '../lib/telegram';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  const [stats, setStats] = useState(null);

  // Telegram
  const [tg, setTg] = useState(null);
  const [tgCode, setTgCode] = useState('');
  const [tgBusy, setTgBusy] = useState(false);
  const [tgError, setTgError] = useState('');

  // Parol
  const [showPass, setShowPass] = useState(false);
  const [passForm, setPassForm] = useState({ current: '', next: '', repeat: '' });
  const [passBusy, setPassBusy] = useState(false);
  const [passMsg, setPassMsg] = useState('');
  const [passError, setPassError] = useState('');

  const loadTg = useCallback(async () => {
    try {
      setTg(await api.get('/telegram/status'));
    } catch {
      setTg({ enabled: false, linked: false });
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login', { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    loadTg();
    api.get('/stats/me').then(setStats).catch(() => setStats(null));
  }, [user, loadTg]);

  async function getCode() {
    setTgBusy(true);
    setTgError('');
    try {
      setTgCode((await api.post('/telegram/link-code', {})).code);
    } catch (err) {
      setTgError(err.message || 'Kod olinmadi.');
    }
    setTgBusy(false);
  }

  async function unlink() {
    setTgBusy(true);
    setTgError('');
    try {
      await api.post('/telegram/unlink', {});
      setTgCode('');
      await loadTg();
    } catch (err) {
      setTgError(err.message || 'Uzilmadi.');
    }
    setTgBusy(false);
  }

  async function changePassword(event) {
    event.preventDefault();
    setPassError('');
    setPassMsg('');

    if (passForm.next.length < 8) {
      setPassError('Yangi parol kamida 8 ta belgidan iborat bo‘lsin.');
      return;
    }
    if (passForm.next !== passForm.repeat) {
      setPassError('Yangi parol ikki joyda bir xil yozilmagan.');
      return;
    }

    setPassBusy(true);
    try {
      const res = await api.post('/auth/change-password', {
        currentPassword: passForm.current,
        newPassword: passForm.next,
      });
      setPassMsg(res.message || 'Parol almashtirildi.');
      setPassForm({ current: '', next: '', repeat: '' });
      setShowPass(false);
    } catch (err) {
      setPassError(err.message);
    }
    setPassBusy(false);
  }

  if (authLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f5ef]">
        <p className="text-[14px] text-[#6b7a6f]">Yuklanmoqda...</p>
      </main>
    );
  }

  if (!user) return null;

  const initials = (user.full_name || user.username)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <main className="min-h-screen bg-[#f3f5ef] pb-20 text-[#1f2b22]">
      <div className="mx-auto max-w-3xl px-5 pt-6">
        <Link to="/" className="text-[14px] text-[#6b7a6f] hover:text-[#1f2b22]">
          ← Bosh sahifa
        </Link>

        {/* ------------------------------------------------------- shaxs */}
        <header className="mt-6 flex flex-wrap items-center gap-5 rounded-2xl border border-[#e2e8dd] bg-white px-6 py-6">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#2f5d3a] text-[22px] font-bold text-white">
            {initials}
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[24px] font-bold leading-tight">{user.full_name}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-[#6b7a6f]">
              <span>@{user.username}</span>
              {user.class_name && (
                <>
                  <span className="text-[#c8d2c4]">·</span>
                  <span>{user.class_name}</span>
                </>
              )}
              <span className="text-[#c8d2c4]">·</span>
              <span>{user.school_code}</span>
              {isAdmin && (
                <span className="rounded-md bg-[#ecf3ea] px-2 py-0.5 font-semibold text-[#2f5d3a]">
                  {user.role === 'owner' ? 'owner' : 'Eco Team'}
                </span>
              )}
            </p>
          </div>

        </header>

        {/* Telefonda panelga yetib borish qiyin edi — shuning uchun alohida,
            yirik va ko'zga tashlanadigan kirish joyi */}
        {isAdmin && (
          <Link
            to="/admin"
            className="mt-4 flex items-center gap-4 rounded-2xl border border-[#cfe0cb] bg-[#2f5d3a] px-6 py-5 text-white transition-colors hover:bg-[#285032]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 text-[20px]">
              🗂
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-bold">Admin panel</span>
              <span className="mt-0.5 block text-[13px] text-white/75">
                Topshiriqlarni tasdiqlash, recycling, o‘quvchilar
              </span>
            </span>
            <span className="shrink-0 text-[20px] text-white/60">›</span>
          </Link>
        )}

        {/* -------------------------------------------------------- ball */}
        <section className="mt-4 grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-[#e2e8dd] bg-white px-6 py-6">
            <p className="text-[13px] text-[#6b7a6f]">Eco ballaringiz</p>
            <p className="mt-1.5 text-[42px] font-bold leading-none tabular-nums text-[#2f5d3a]">
              {user.points ?? 0}
            </p>

            {stats && user.role === 'student' && (
              <p className="mt-4 text-[13px] leading-6 text-[#6b7a6f]">
                Maktab bo‘yicha <b className="text-[#1f2b22]">#{stats.rank}</b>-o‘rindasiz.
                {stats.toNext != null &&
                  (stats.toNext > 0 ? (
                    <>
                      {' '}
                      Oldingi o‘rinni egallash uchun yana{' '}
                      <b className="text-[#1f2b22]">{stats.toNext} ball</b> kerak.
                    </>
                  ) : (
                    ' Oldingi o‘quvchi bilan ball tengsiz.'
                  ))}
                {stats.toNext === null && ' Hozircha birinchisiz.'}
              </p>
            )}

            <Link
              to="/leaderboard"
              className="mt-5 inline-block text-[13px] font-medium text-[#2f5d3a] underline"
            >
              Reytingni ko‘rish
            </Link>
          </div>

          <div className="rounded-2xl border border-[#e2e8dd] bg-white px-6 py-6">
            <p className="text-[13px] text-[#6b7a6f]">Mening hissam</p>

            {stats ? (
              <dl className="mt-4 space-y-3.5">
                <Line
                  label="Topshiriqlar"
                  value={stats.challenges.approved}
                  pending={stats.challenges.pending}
                />
                <Line
                  label="Recycling"
                  value={`${Math.round(stats.recycling.kg * 10) / 10} kg`}
                  pending={stats.recycling.pending}
                />
                <Line
                  label="Tadqiqotlar"
                  value={stats.research.approved}
                  pending={stats.research.pending}
                />
              </dl>
            ) : (
              <p className="mt-4 text-[13px] text-[#9aa89d]">Yuklanmoqda...</p>
            )}
          </div>
        </section>

        {/* ---------------------------------------------------- telegram */}
        {tg?.enabled && (
          <section className="mt-4 rounded-2xl border border-[#e2e8dd] bg-white px-6 py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-[17px] font-bold">Telegram eslatmalari</h2>
                <p className="mt-1.5 max-w-md text-[13px] leading-6 text-[#6b7a6f]">
                  {tg.linked
                    ? 'Hisobingiz ulangan. Dushanba kunlari bajarilmagan vazifalar ro‘yxati, topshiriq tasdiqlanganda esa darhol xabar keladi.'
                    : 'Botni ulasangiz, yangi vazifalar va ballaringiz haqida Telegramda xabar olib turasiz.'}
                </p>
              </div>

              {tg.linked ? (
                <button
                  type="button"
                  onClick={unlink}
                  disabled={tgBusy}
                  className="shrink-0 rounded-xl border border-[#d6ded1] px-5 py-2.5 text-[14px] font-medium text-[#6b7a6f] hover:text-[#1f2b22] disabled:opacity-50"
                >
                  {tgBusy ? 'Uzilmoqda...' : 'Uzish'}
                </button>
              ) : (
                !tgCode && (
                  <button
                    type="button"
                    onClick={getCode}
                    disabled={tgBusy}
                    className="shrink-0 rounded-xl bg-[#2f5d3a] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#285032] disabled:opacity-50"
                  >
                    {tgBusy ? 'Kod olinmoqda...' : 'Ulash'}
                  </button>
                )
              )}
            </div>

            {!tg.linked && tgCode && (
              <div className="mt-5 rounded-xl bg-[#f3f6f1] px-5 py-5">
                <p className="text-[13px] text-[#6b7a6f]">Ulash kodingiz</p>
                <p className="mt-2 font-mono text-[30px] font-bold tracking-[0.25em] text-[#2f5d3a]">
                  {tgCode}
                </p>

                <ol className="mt-5 space-y-2 text-[13px] leading-6 text-[#30402f]">
                  <li>
                    1.{' '}
                    {tg.botUsername ? (
                      <a
                        href={`https://t.me/${tg.botUsername}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-[#2f5d3a] underline"
                      >
                        @{tg.botUsername}
                      </a>
                    ) : (
                      'Maktab botini'
                    )}{' '}
                    Telegramda oching va <b>Start</b> bosing.
                  </li>
                  <li>2. Shu kodni botga xabar qilib yuboring.</li>
                  <li>3. Bot “tayyor” deb javob bersa, ulandi.</li>
                </ol>

                <div className="mt-5 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={loadTg}
                    className="rounded-lg bg-white px-4 py-2 text-[13px] font-medium text-[#2f5d3a] ring-1 ring-[#d6ded1]"
                  >
                    Ulanishni tekshirish
                  </button>
                  <span className="text-[12px] text-[#9aa89d]">Kod 15 daqiqa amal qiladi.</span>
                </div>
              </div>
            )}

            {tgError && <p className="mt-4 text-[13px] text-[#8f4539]">{tgError}</p>}
          </section>
        )}

        {/* ------------------------------------------------------- hisob */}
        <section className="mt-4 rounded-2xl border border-[#e2e8dd] bg-white px-6 py-6">
          <h2 className="text-[17px] font-bold">Hisob</h2>

          {passMsg && (
            <p className="mt-4 rounded-xl bg-[#ecf3ea] px-4 py-3 text-[14px] text-[#2f5d3a]">
              {passMsg}
            </p>
          )}

          {showPass ? (
            <form onSubmit={changePassword} className="mt-5 max-w-sm space-y-4">
              <Field
                label="Hozirgi parol"
                value={passForm.current}
                onChange={(v) => setPassForm({ ...passForm, current: v })}
              />
              <Field
                label="Yangi parol"
                value={passForm.next}
                onChange={(v) => setPassForm({ ...passForm, next: v })}
                hint="Kamida 8 ta belgi"
              />
              <Field
                label="Yangi parolni takrorlang"
                value={passForm.repeat}
                onChange={(v) => setPassForm({ ...passForm, repeat: v })}
              />

              {passError && <p className="text-[13px] text-[#8f4539]">{passError}</p>}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={passBusy}
                  className="rounded-xl bg-[#2f5d3a] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#285032] disabled:opacity-50"
                >
                  {passBusy ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPass(false);
                    setPassError('');
                  }}
                  className="text-[14px] text-[#6b7a6f] hover:text-[#1f2b22]"
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPass(true);
                  setPassMsg('');
                }}
                className="rounded-xl border border-[#d6ded1] px-5 py-2.5 text-[14px] font-medium hover:bg-[#f7f9f5]"
              >
                Parolni almashtirish
              </button>

              {/* Telegram ichida chiqishdan ma'no yo'q — keyingi ochilishda
                  bot imzosi bilan yana o'zi kiradi */}
              {!inTelegram() && (
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    navigate('/login', { replace: true });
                  }}
                  className="rounded-xl px-5 py-2.5 text-[14px] font-medium text-[#8f4539] hover:bg-[#f9efed]"
                >
                  Tizimdan chiqish
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Line({ label, value, pending }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[14px] text-[#6b7a6f]">{label}</dt>
      <dd className="text-right">
        <span className="text-[16px] font-semibold tabular-nums">{value}</span>
        {pending > 0 && (
          <span className="ml-2 text-[12px] text-[#8a5f10]">{pending} kutilmoqda</span>
        )}
      </dd>
    </div>
  );
}

function Field({ label, value, onChange, hint }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-[#30402f]">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="mt-2 w-full rounded-xl border border-[#d6ded1] px-4 py-2.5 text-[15px] outline-none focus:border-[#2f5d3a]"
      />
      {hint && <span className="mt-1.5 block text-[12px] text-[#9aa89d]">{hint}</span>}
    </label>
  );
}
