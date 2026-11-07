import { useEffect, useState } from 'react';
import { api } from '../lib/api';


const PERIODS = [
  { value: 'week', label: 'Shu hafta' },
  { value: 'month', label: 'Shu oy' },
  { value: 'all', label: 'Umumiy' },
];

/** Davr almashtirgich — reyting har hafta yangilanib tursin. */
function PeriodSwitch({ value, onChange }) {
  return (
    <div className="inline-flex gap-1 rounded-xl bg-[#e9efe6] p-1">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            value === p.value
              ? 'bg-white text-[#24352b] shadow-[0_1px_2px_rgba(31,43,34,0.08)]'
              : 'text-[#5e6d60] hover:text-[#24352b]'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export default function ClassLeaderboardPage() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [period, setPeriod] = useState('week');

  async function loadClasses(which = period) {
    setLoading(true);
    setMessage('');

    try {
      const data = await api.get(`/stats/class-leaderboard?period=${which}`);
      setClasses(
        (data.classes || []).map((item) => ({
          class_name: item.class_name,
          student_count: Number(item.student_count) || 0,
          total_points: Number(item.total_points) || 0,
          recycling_kg: Number(item.recycling_kg) || 0,
          approved_challenges: Number(item.approved_challenges) || 0,
        })),
      );
    } catch (error) {
      if (error.status === 401) {
        setMessage('Reytingni ko‘rish uchun tizimga kiring.');
      } else {
        setMessage('Yuklashda xatolik: ' + error.message);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadClasses(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const topThree = classes.slice(0, 3);

  return (
    <main className="min-h-screen bg-[#f7f8f3] px-5 py-10 text-[#24352b]">
      <div className="mx-auto max-w-5xl">
        <a href="/" className="text-sm font-medium text-green-800">
          ← Bosh sahifa
        </a>

        <header className="mb-10 mt-7">
          <p className="text-sm font-semibold uppercase tracking-widest text-green-700">
            ECO SCHOOL · CLASS VS CLASS
          </p>

          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Sinflar bellashuvi</h1>

          <div className="mt-6">
            <PeriodSwitch value={period} onChange={setPeriod} />
          </div>

          <p className="mt-4 max-w-2xl leading-7 text-[#66746a]">
            Birgalikdagi harakat — katta o‘zgarish. Qaysi sinf maktabimiz
            ekologiyasiga eng katta hissa qo‘shmoqda?
          </p>
        </header>

        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          Reyting faqat tizimga kirgan maktab a’zolariga ko‘rinadi. Natijalar
          tasdiqlangan ballar asosida hisoblanadi.
        </div>

        {message && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{message}</div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-gray-500">
            Sinflar reytingi yuklanmoqda...
          </div>
        ) : classes.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-gray-500">
            Hozircha sinflar haqida ma’lumot mavjud emas.
          </div>
        ) : (
          <>
            <section className="mb-8 grid gap-4 sm:grid-cols-3">
              {topThree.map((item, index) => (
                <article
                  key={item.class_name}
                  className={`rounded-2xl border bg-white p-6 text-center ${
                    index === 0 ? 'border-amber-300 sm:-translate-y-2' : 'border-[#e3e9df]'
                  }`}
                >
                  <div className="text-4xl">{['🥇', '🥈', '🥉'][index]}</div>

                  <h2 className="mt-4 text-2xl font-bold">{item.class_name}</h2>

                  <p className="mt-2 text-sm text-gray-500">
                    {item.student_count} nafar o‘quvchi
                  </p>

                  <p className="mt-4 text-3xl font-bold text-green-800">
                    {item.total_points.toLocaleString('uz-UZ')}
                  </p>

                  <p className="text-xs text-gray-500">ball</p>
                </article>
              ))}
            </section>

            <section className="overflow-hidden rounded-2xl border border-[#e3e9df] bg-white">
              <div className="border-b border-[#e3e9df] p-5">
                <h2 className="text-xl font-bold">Barcha sinflar</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {classes.length} ta sinf reytingda
                </p>
              </div>

              <div className="divide-y divide-[#edf0e9]">
                {classes.map((item, index) => (
                  <article key={item.class_name} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <span className="w-9 text-sm font-bold text-gray-400">
                          #{index + 1}
                        </span>

                        <div>
                          <h3 className="text-lg font-bold">{item.class_name}</h3>
                          <p className="text-sm text-gray-500">
                            {item.student_count} nafar o‘quvchi
                          </p>
                        </div>
                      </div>

                      <p className="text-lg font-bold text-green-800">
                        {item.total_points.toLocaleString('uz-UZ')} ball
                      </p>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-[#f7f8f3] p-3">
                        <p className="text-xs text-gray-500">Recycling</p>
                        <p className="mt-1 font-bold">
                          {item.recycling_kg.toLocaleString('uz-UZ')} kg
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#f7f8f3] p-3">
                        <p className="text-xs text-gray-500">Challenge‘lar</p>
                        <p className="mt-1 font-bold">{item.approved_challenges} ta</p>
                      </div>

                      <div className="col-span-2 rounded-xl bg-[#f7f8f3] p-3 sm:col-span-1">
                        <p className="text-xs text-gray-500">Sinf o‘quvchilari</p>
                        <p className="mt-1 font-bold">{item.student_count} nafar</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        <button
          onClick={loadClasses}
          disabled={loading}
          className="mt-7 rounded-xl bg-green-800 px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          Reytingni yangilash
        </button>
      </div>
    </main>
  );
}
