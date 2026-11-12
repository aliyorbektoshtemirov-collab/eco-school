import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import Mentors from '../components/Mentors';
import { useAuth } from '../lib/auth';

const challenges = [
  {
    icon: '♻️',
    category: 'CHIQINDILAR',
    title: 'Plastiksiz bir hafta',
    description: 'Bir martalik plastikdan foydalanishni kamaytiring.',
    color: 'bg-[#e8f0e4]',
  },
  {
    icon: '📄',
    category: 'RESURSLAR',
    title: 'Qog‘ozni asraymiz',
    description: 'Qog‘ozni tejang va qayta ishlashga topshiring.',
    color: 'bg-[#f5eddf]',
  },
  {
    icon: '💡',
    category: 'ENERGIYA',
    title: 'Chiroqni o‘chir!',
    description: 'Keraksiz chiroqlarni o‘chirib, energiyani tejang.',
    color: 'bg-[#e8edf3]',
  },
];

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        // Statistika faqat tizimga kirganlarga ochiq
        if (user) {
          const data = await api.get('/stats/impact');
          if (active) setImpact(data.impact);
        }
      } catch (error) {
        console.error('Homepage data error:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    if (!authLoading) loadData();

    return () => {
      active = false;
    };
  }, [user, authLoading]);

  const firstName = user?.full_name?.trim()?.split(' ')[0] || 'o‘quvchi';

  return (
    <main className="min-h-screen bg-[#fafaf7] text-[#263127]">
      {/* NAVIGATION */}
      <header className="sticky top-0 z-50 border-b border-[#e8eae2] bg-[#fafaf7]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#315b3b] text-xl text-white">
              🌱
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">ECO SCHOOL</div>
              <div className="text-[9px] tracking-[0.2em] text-[#788078]">
                MEASURE. ACT. IMPROVE.
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-5 text-sm text-[#626b60] lg:flex">
            <Link to="/challenges" className="hover:text-[#315b3b]">Challengelar</Link>
            <Link to="/marafon" className="hover:text-[#315b3b]">Marafon</Link>
            <Link to="/recycling" className="hover:text-[#315b3b]">Recycling</Link>
            <Link to="/impact" className="hover:text-[#315b3b]">Natijalar</Link>
            <Link to="/leaderboard" className="hover:text-[#315b3b]">Reyting</Link>
            <Link to="/research" className="hover:text-[#315b3b]">Research</Link>
            <Link to="/calendar" className="hover:text-[#315b3b]">Taqvim</Link>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="https://t.me/ecofutureandijan"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-full bg-[#315b3b] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#25482e] sm:inline-flex"
            >
              Telegram ↗
            </a>

            <Link
              to={user ? '/profile' : '/login'}
              className="rounded-full border border-[#dce1d7] px-4 py-2.5 text-sm font-medium transition hover:bg-white"
            >
              {user ? 'Profilim' : 'Kirish'}
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-6 py-12 md:grid-cols-2 md:py-20">
          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dce7d9] bg-[#f0f5ed] px-4 py-2 text-xs font-medium text-[#47764c]">
              🌱 Kichik harakatlar. Katta o‘zgarishlar.
            </div>

            {user ? (
              <>
                <h1 className="text-5xl font-semibold leading-tight tracking-tight md:text-6xl">
                  Salom, <span className="text-[#527d55]">{firstName}!</span>
                </h1>
                <p className="mt-6 max-w-lg text-base leading-8 text-[#70776e]">
                  Bugun ham tabiat uchun foydali bir ish qilamizmi? Har bir harakatingiz
                  maktabimiz kelajagi uchun muhim.
                </p>
                <div className="mt-7 rounded-2xl border border-[#e5e9df] bg-white p-5">
                  <p className="text-sm text-[#7a8178]">Sizning ballaringiz</p>
                  <p className="mt-2 text-4xl font-semibold text-[#315b3b]">
                    {user.points ?? 0} <span className="text-base">ball</span>
                  </p>
                  {user.class_name && (
                    <p className="mt-1 text-xs text-[#92988f]">{user.class_name}-sinf</p>
                  )}
                  <Link to="/profile" className="mt-4 inline-block text-sm font-semibold text-[#47764c]">
                    Profilimni ko‘rish ↗
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h1 className="max-w-xl text-5xl font-semibold leading-[1.12] tracking-tight md:text-7xl">
                  Maktabimizning
                  <span className="block text-[#527d55]">ta'siri bor.</span>
                </h1>

                <p className="mt-6 max-w-lg text-base leading-8 text-[#70776e] md:text-lg">
                  Har bir kichik harakat muhim. Ekologik muammolarni kamaytiramiz,
                  natijalarni o‘lchaymiz va birgalikda yaxshi o‘zgarish yaratamiz.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    to="/challenges"
                    className="rounded-full bg-[#315b3b] px-7 py-3.5 text-sm font-medium text-white transition hover:bg-[#25482e]"
                  >
                    Challenge'larni ko‘rish ↗
                  </Link>
                  <Link
                    to="/login"
                    className="rounded-full border border-[#d8ddd5] px-7 py-3.5 text-sm font-medium transition hover:bg-white"
                  >
                    Ishtirok etish
                  </Link>
                </div>
              </>
            )}

            <div className="mt-8 flex items-center gap-3 text-sm text-[#7a8178]">
              <span className="text-xl">🌍</span>
              O‘zgarish bizdan boshlanadi.
            </div>
          </div>

          {/* TIMO */}
          <div className="relative flex items-center justify-center">
            <div className="absolute h-72 w-72 rounded-full bg-[#e5eedf] blur-3xl" />

            <div className="relative w-full max-w-[490px]">
              <img
                src="/timo.png"
                alt="Timo — ECO SCHOOL maskoti"
                width={900}
                height={1200}
                className="relative z-10 mx-auto h-auto max-h-[530px] w-auto object-contain drop-shadow-xl"
              />

              <div className="absolute right-0 top-8 z-20 max-w-[210px] rounded-3xl rounded-bl-sm bg-white p-4 shadow-lg md:right-[-10px]">
                <p className="font-semibold text-[#315b3b]">Salom! Men Timo 🐢</p>
                <p className="mt-1 text-xs leading-5 text-[#727a70]">
                  Birga tabiatni asraymiz!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PERSONAL ACTIONS */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="mb-7">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#648367]">
            SIZNING FAOLIYATINGIZ
          </p>
          <h2 className="mt-3 text-3xl font-semibold">Bugun qanday harakat qilamiz?</h2>
          <p className="mt-2 text-sm text-[#858b82]">
            O‘zingizga mos ekologik faoliyatni tanlang.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: '🎯', title: 'Challenge bajaring', description: 'Ekologik vazifalarda qatnashing.', href: '/challenges' },
            { icon: '♻️', title: 'Recycling', description: 'Qog‘oz va plastik topshiring.', href: '/recycling' },
            { icon: '📚', title: 'Research', description: 'Tadqiqotingizni ulashing.', href: '/research' },
            { icon: '🏆', title: 'Reyting', description: 'Natijalaringizni kuzating.', href: '/leaderboard' },
          ].map((item) => (
            <Link
              key={item.title}
              to={item.href}
              className="group rounded-2xl border border-[#e8eae2] bg-white p-6 transition hover:-translate-y-1 hover:shadow-md"
            >
              <span className="text-3xl">{item.icon}</span>
              <h3 className="mt-5 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#7a8178]">{item.description}</p>
              <span className="mt-5 inline-block text-sm font-semibold text-[#47764c]">
                Ochish ↗
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* IMPACT */}
      <section className="bg-white py-16" id="impact">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-[#648367]">
                MAKTABIMIZ NATIJALARI
              </p>
              <h2 className="mt-3 text-3xl font-semibold">Harakatlarimiz raqamlarda.</h2>
              <p className="mt-2 text-sm text-[#858b82]">
                Tasdiqlangan ekologik faoliyat natijalari.
              </p>
            </div>
            <Link to="/impact" className="text-sm font-semibold text-[#47764c]">
              Batafsil ko‘rish ↗
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Qog‘oz', value: impact ? `${Number(impact.paper_kg).toFixed(1)} kg` : '—', icon: '📄' },
              { label: 'Plastik', value: impact ? `${Number(impact.plastic_kg).toFixed(1)} kg` : '—', icon: '♻️' },
              { label: 'Faol o‘quvchilar', value: impact ? impact.active_students : '—', icon: '👥' },
              { label: 'Tasdiqlangan topshiriqlar', value: impact ? impact.approved_challenges : '—', icon: '✓' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#e9e9e2] bg-[#fafaf7] p-5 md:p-7">
                <span className="text-2xl">{item.icon}</span>
                <p className="mt-4 text-sm text-[#7b8279]">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-[#315b3b] md:text-3xl">
                  {loading ? '...' : item.value}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-[#92988f]">
            Ko‘rsatkichlar tasdiqlangan ma’lumotlar asosida shakllantiriladi.
            “—” ma’lumot hali mavjud emasligini bildiradi.
          </p>
        </div>
      </section>

      {/* CHALLENGES */}
      <section className="bg-[#f0f2eb] py-16" id="challenges">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-[#648367]">
                ECO CHALLENGES
              </p>
              <h2 className="mt-3 text-3xl font-semibold">Harakatga qo‘shiling!</h2>
              <p className="mt-2 text-sm text-[#777f75]">
                Kichik vazifalar orqali katta o‘zgarishlar yarating.
              </p>
            </div>
            <Link to="/challenges" className="text-sm font-semibold text-[#47764c]">
              Barcha challengelar ↗
            </Link>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {challenges.map((challenge, index) => (
              <article
                key={challenge.title}
                className="rounded-2xl border border-[#e5e7df] bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9a9f96]">0{index + 1} / 03</span>
                  <span className={`rounded-full px-3 py-2 text-xs ${challenge.color}`}>
                    {challenge.category}
                  </span>
                </div>
                <div className="mt-7 text-4xl">{challenge.icon}</div>
                <h3 className="mt-5 text-xl font-semibold">{challenge.title}</h3>
                <p className="mt-3 min-h-12 text-sm leading-6 text-[#7a8178]">
                  {challenge.description}
                </p>
                <Link to="/challenges" className="mt-6 inline-block text-sm font-semibold text-[#47764c]">
                  Ishtirok etish ↗
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* MORE SECTIONS */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-4 md:grid-cols-3">
          <Link to="/class-leaderboard" className="rounded-2xl bg-[#e8eee5] p-7 transition hover:shadow-md">
            <span className="text-3xl">🏫</span>
            <h3 className="mt-5 text-xl font-semibold">Sinfimiz reytingi</h3>
            <p className="mt-2 text-sm text-[#687568]">
              Boshqa sinflar bilan do‘stona raqobatlashing.
            </p>
            <span className="mt-5 inline-block text-sm font-semibold text-[#315b3b]">
              Ko‘rish ↗
            </span>
          </Link>

          <Link to="/calendar" className="rounded-2xl bg-[#f5eddf] p-7 transition hover:shadow-md">
            <span className="text-3xl">📅</span>
            <h3 className="mt-5 text-xl font-semibold">Eco Calendar</h3>
            <p className="mt-2 text-sm text-[#81745f]">
              Ekologik tadbirlar va muhim sanalarni kuzating.
            </p>
            <span className="mt-5 inline-block text-sm font-semibold text-[#80643d]">
              Taqvimni ochish ↗
            </span>
          </Link>

          <a
            href="https://t.me/ecofutureandijan"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl bg-[#e8edf3] p-7 transition hover:shadow-md"
          >
            <span className="text-3xl">✈️</span>
            <h3 className="mt-5 text-xl font-semibold">Telegram hamjamiyati</h3>
            <p className="mt-2 text-sm text-[#687585]">
              Eco Future Andijan kanalimizga qo‘shiling.
            </p>
            <span className="mt-5 inline-block text-sm font-semibold text-[#315b3b]">
              Kanalga o‘tish ↗
            </span>
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <div className="mx-auto max-w-6xl px-5"><Mentors isOwner={user?.role === 'owner'} /></div>
      <footer className="border-t border-[#e9e9e2] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-6 py-8 text-sm text-[#858b82] md:flex-row">
          <div>
            <div className="font-bold tracking-wider text-[#315b3b]">ECO SCHOOL</div>
            <p className="mt-2 text-xs">Measure. Act. Improve.</p>
          </div>

          <a
            href="https://t.me/ecofutureandijan"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-[#47764c]"
          >
            Telegram kanalimiz ↗
          </a>

          <p className="text-xs">© 2026 ECO SCHOOL</p>
        </div>
      </footer>
    </main>
  );
}
