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

export default function LeaderboardPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [period, setPeriod] = useState('week');

  async function loadLeaderboard(which = period) {
    setLoading(true);
    setMessage('');

    try {
      const data = await api.get(`/stats/leaderboard?period=${which}`);
      setStudents((data.students || []).map((item) => ({ ...item, points: Number(item.points) || 0 })));
    } catch (error) {
      if (error.status === 401) {
        setMessage('Reytingni ko‘rish uchun tizimga kiring.');
      } else {
        setMessage('Reytingni yuklashda xatolik: ' + error.message);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadLeaderboard(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const topThree = students.slice(0, 3);

  return (
    <main className="min-h-screen bg-[#f7f8f3] px-5 py-10 text-[#24352b]">
      <div className="mx-auto max-w-4xl">
        <a href="/" className="text-sm font-medium text-green-800">
          ← Bosh sahifa
        </a>

        <header className="mb-10 mt-7">
          <p className="text-sm font-semibold uppercase tracking-widest text-green-700">
            ECO SCHOOL · LEADERBOARD
          </p>

          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Ekologik yetakchilar</h1>

          <div className="mt-6">
            <PeriodSwitch value={period} onChange={setPeriod} />
          </div>

          <p className="mt-4 max-w-2xl leading-7 text-[#66746a]">
            Har bir ekologik harakat muhim. Maktabimizdagi eng faol o‘quvchilar bilan
            tanishing.
          </p>
        </header>

        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          Bu reyting faqat tizimga kirgan maktab a’zolari uchun. Ism-familiya
          ko‘rsatilishi maktab va ota-onalar roziligi asosida bo‘lishi kerak.
        </div>

        {message && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{message}</div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-gray-500">Reyting yuklanmoqda...</div>
        ) : students.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-gray-500">
            Hozircha reyting uchun ma’lumot mavjud emas.
          </div>
        ) : (
          <>
            {topThree.length > 0 && (
              <section className="mb-8 grid gap-4 sm:grid-cols-3">
                {topThree.map((student, index) => (
                  <article
                    key={student.student_id}
                    className={`rounded-2xl border bg-white p-6 text-center ${
                      index === 0 ? 'border-amber-300 sm:-translate-y-2' : 'border-[#e3e9df]'
                    }`}
                  >
                    <div className="text-4xl">{['🥇', '🥈', '🥉'][index]}</div>

                    <p className="mt-4 font-bold">{student.full_name || 'O‘quvchi'}</p>

                    <p className="mt-1 text-sm text-gray-500">
                      {student.class_name || 'Sinf ko‘rsatilmagan'}
                    </p>

                    <p className="mt-4 text-2xl font-bold text-green-800">
                      {student.points.toLocaleString('uz-UZ')}
                    </p>

                    <p className="text-xs text-gray-500">ball</p>
                  </article>
                ))}
              </section>
            )}

            <section className="overflow-hidden rounded-2xl border border-[#e3e9df] bg-white">
              <div className="border-b border-[#e3e9df] p-5">
                <h2 className="text-xl font-bold">O‘quvchilar reytingi</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Jami {students.length} nafar o‘quvchi
                </p>
              </div>

              <div className="divide-y divide-[#edf0e9]">
                {students.map((student, index) => (
                  <div
                    key={student.student_id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="w-8 shrink-0 text-sm font-bold text-gray-400">
                        #{index + 1}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {student.full_name || 'O‘quvchi'}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {student.class_name || 'Sinf ko‘rsatilmagan'}
                        </p>
                      </div>
                    </div>

                    <p className="shrink-0 font-bold text-green-800">
                      {student.points.toLocaleString('uz-UZ')} ball
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <button
          onClick={loadLeaderboard}
          disabled={loading}
          className="mt-7 rounded-xl bg-green-800 px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          Reytingni yangilash
        </button>
      </div>
    </main>
  );
}
