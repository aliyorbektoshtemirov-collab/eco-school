import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function ResearchPage() {
  const { user } = useAuth();

  const [research, setResearch] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('published');

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [sources, setSources] = useState('');

  const [reviewPoints, setReviewPoints] = useState({});
  const [feedback, setFeedback] = useState({});

  const userId = user?.id;

  async function loadResearch() {
    setLoading(true);
    setMessage('');

    try {
      const data = await api.get('/research');
      setIsAdmin(Boolean(data.isAdmin));
      setResearch(data.research || []);
    } catch (error) {
      if (error.status === 401) {
        setMessage('Davom etish uchun tizimga kiring.');
      } else {
        setMessage('Tadqiqotlarni yuklashda xatolik: ' + error.message);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadResearch();
  }, []);

  async function submitResearch(e) {
    e.preventDefault();
    setMessage('');

    if (title.trim().length < 5 || summary.trim().length < 20 || content.trim().length < 100) {
      setMessage(
        'Sarlavha kamida 5, qisqacha mazmun 20, tadqiqot matni esa 100 ta belgidan iborat bo‘lishi kerak.',
      );
      return;
    }

    try {
      await api.post('/research', {
        title: title.trim(),
        summary: summary.trim(),
        content: content.trim(),
        sources: sources.trim() || undefined,
      });
    } catch (error) {
      setMessage('Tadqiqot yuborilmadi: ' + error.message);
      return;
    }

    setTitle('');
    setSummary('');
    setContent('');
    setSources('');
    setShowForm(false);
    setActiveTab('mine');
    setMessage('Tadqiqotingiz tekshiruvga yuborildi!');

    await loadResearch();
  }

  async function reviewResearch(item, status) {
    setMessage('');

    const points =
      status === 'published'
        ? Math.max(0, Math.min(40, Number(reviewPoints[item.id] ?? 0)))
        : 0;

    try {
      await api.post(`/research/${item.id}/review`, {
        status,
        points,
        feedback: feedback[item.id]?.trim() || undefined,
      });
    } catch (error) {
      setMessage('Tekshiruvda xatolik: ' + error.message);
      return;
    }

    setMessage(
      status === 'published'
        ? 'Tadqiqot nashr qilindi va ball berildi!'
        : 'Tadqiqot rad etildi.',
    );

    await loadResearch();
  }

  const publishedResearch = research.filter((item) => item.status === 'published');
  const myResearch = research.filter((item) => item.student_id === userId);
  const pendingResearch = research.filter((item) => item.status === 'pending');

  const visibleResearch =
    activeTab === 'published'
      ? publishedResearch
      : activeTab === 'mine'
        ? myResearch
        : pendingResearch;

  const statusLabels = {
    pending: 'Tekshiruvda',
    published: 'Nashr qilindi',
    rejected: 'Rad etildi',
  };

  const statusColors = {
    pending: 'bg-amber-100 text-amber-800',
    published: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  return (
    <main className="min-h-screen bg-[#f7f8f3] px-5 py-10 text-[#24352b]">
      <div className="mx-auto max-w-5xl">
        <a href="/" className="text-sm font-medium text-green-800">
          ← Bosh sahifa
        </a>

        <header className="mb-9 mt-7">
          <p className="text-sm font-semibold uppercase tracking-widest text-green-700">
            ECO SCHOOL · KNOWLEDGE
          </p>

          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Eco Research</h1>

          <p className="mt-4 max-w-2xl leading-7 text-[#66746a]">
            Izlaning, tahlil qiling va bilimlaringiz bilan boshqalarga yordam bering.
            Har bir yaxshi tadqiqot ekologik kelajak sari qadamdir.
          </p>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#e3e9df] bg-white p-5">
            <p className="text-sm text-gray-500">Nashr qilingan</p>
            <p className="mt-2 text-3xl font-bold text-green-800">
              {publishedResearch.length}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e3e9df] bg-white p-5">
            <p className="text-sm text-gray-500">Mening tadqiqotlarim</p>
            <p className="mt-2 text-3xl font-bold">{myResearch.length}</p>
          </div>

          <div className="rounded-2xl border border-[#e3e9df] bg-white p-5">
            <p className="text-sm text-gray-500">Tekshiruvda</p>
            <p className="mt-2 text-3xl font-bold text-amber-700">
              {isAdmin
                ? pendingResearch.length
                : myResearch.filter((item) => item.status === 'pending').length}
            </p>
          </div>
        </section>

        {message && (
          <div className="mb-6 rounded-xl bg-green-50 p-4 text-sm text-green-900">
            {message}
          </div>
        )}

        <button
          onClick={() => setShowForm(!showForm)}
          className="mb-6 rounded-xl bg-green-800 px-5 py-3 font-semibold text-white"
        >
          + Tadqiqot yuborish
        </button>

        {showForm && (
          <form
            onSubmit={submitResearch}
            className="mb-8 grid gap-4 rounded-2xl border border-[#e3e9df] bg-white p-6"
          >
            <h2 className="text-xl font-bold">Yangi tadqiqot</h2>

            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tadqiqot sarlavhasi"
              className="rounded-xl border p-3"
            />

            <textarea
              required
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Qisqacha mazmun"
              rows={3}
              className="rounded-xl border p-3"
            />

            <textarea
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tadqiqotingizning to‘liq matni"
              rows={9}
              className="rounded-xl border p-3"
            />

            <textarea
              value={sources}
              onChange={(e) => setSources(e.target.value)}
              placeholder="Foydalanilgan manbalar (nomi va havolalari)"
              rows={3}
              className="rounded-xl border p-3"
            />

            <p className="text-xs leading-5 text-gray-500">
              Tadqiqotingiz avval tekshiruvdan o‘tadi. Nashr qilingandan keyin
              boshqalar uni o‘qiy oladi. Manbalarni ko‘rsatishni unutmang.
            </p>

            <button
              type="submit"
              className="rounded-xl bg-green-800 px-5 py-3 font-semibold text-white"
            >
              Tekshiruvga yuborish
            </button>
          </form>
        )}

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('published')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              activeTab === 'published' ? 'bg-green-800 text-white' : 'border bg-white'
            }`}
          >
            Nashr qilinganlar
          </button>

          <button
            onClick={() => setActiveTab('mine')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              activeTab === 'mine' ? 'bg-green-800 text-white' : 'border bg-white'
            }`}
          >
            Mening ishlarim
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('review')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                activeTab === 'review' ? 'bg-green-800 text-white' : 'border bg-white'
              }`}
            >
              Tekshiruv ({pendingResearch.length})
            </button>
          )}
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-gray-500">
            Tadqiqotlar yuklanmoqda...
          </div>
        ) : visibleResearch.length === 0 ? (
          <div className="rounded-2xl border border-[#e3e9df] bg-white p-8 text-center">
            <h2 className="text-lg font-bold">Hozircha tadqiqotlar yo‘q</h2>
            <p className="mt-2 text-sm text-gray-500">
              Birinchi bo‘lib tadqiqot yuborishingiz mumkin.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {visibleResearch.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-[#e3e9df] bg-white p-6"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      statusColors[item.status]
                    }`}
                  >
                    {statusLabels[item.status]}
                  </span>

                  <span className="text-xs text-gray-500">
                    {new Date(item.submitted_at.replace(' ', 'T') + 'Z').toLocaleDateString('uz-UZ')}
                  </span>
                </div>

                <h2 className="text-xl font-bold">{item.title}</h2>

                {isAdmin && item.full_name && (
                  <p className="mt-2 text-sm text-gray-500">
                    Muallif: {item.full_name || 'Noma’lum'}
                    {item.class_name ? ` · ${item.class_name}` : ''}
                  </p>
                )}

                <p className="mt-4 leading-7 text-gray-600">{item.summary}</p>

                <details className="mt-4">
                  <summary className="cursor-pointer font-semibold text-green-800">
                    To‘liq tadqiqotni o‘qish
                  </summary>
                  <div className="mt-3 whitespace-pre-wrap rounded-xl bg-[#f7f8f3] p-4 leading-7 text-gray-700">
                    {item.content}
                  </div>
                </details>

                {item.sources && (
                  <div className="mt-4 rounded-xl bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-900">
                      Foydalanilgan manbalar
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-blue-800">
                      {item.sources}
                    </p>
                  </div>
                )}

                {item.status === 'published' && (
                  <p className="mt-4 text-sm font-semibold text-green-800">
                    Berilgan ball: {item.awarded_points}/40
                  </p>
                )}

                {item.status === 'rejected' && (
                  <p className="mt-4 text-sm text-red-700">
                    Tadqiqot nashr uchun qabul qilinmadi.
                  </p>
                )}

                {item.reviewer_feedback && (
                  <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                    <strong>Tekshiruvchi izohi:</strong>
                    <p className="mt-1">{item.reviewer_feedback}</p>
                  </div>
                )}

                {isAdmin && item.status === 'pending' && (
                  <div className="mt-6 border-t pt-5">
                    <h3 className="font-bold">Tadqiqotni baholash</h3>

                    <label className="mt-4 block text-sm font-medium">
                      Ball (0–40)
                      <input
                        type="number"
                        min="0"
                        max="40"
                        value={reviewPoints[item.id] ?? 0}
                        onChange={(e) =>
                          setReviewPoints((previous) => ({
                            ...previous,
                            [item.id]: Number(e.target.value),
                          }))
                        }
                        className="mt-1 block w-full rounded-xl border p-3"
                      />
                    </label>

                    <textarea
                      value={feedback[item.id] ?? ''}
                      onChange={(e) =>
                        setFeedback((previous) => ({
                          ...previous,
                          [item.id]: e.target.value,
                        }))
                      }
                      placeholder="O‘quvchiga izoh yoki tavsiya"
                      rows={3}
                      className="mt-3 w-full rounded-xl border p-3"
                    />

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={() => reviewResearch(item, 'published')}
                        className="rounded-xl bg-green-800 px-5 py-3 font-semibold text-white"
                      >
                        Nashr qilish
                      </button>

                      <button
                        onClick={() => reviewResearch(item, 'rejected')}
                        className="rounded-xl border border-red-200 px-5 py-3 font-semibold text-red-700"
                      >
                        Rad etish
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-[#e3e9df] bg-white p-6">
          <h2 className="text-lg font-bold">Tadqiqot qanday baholanadi?</h2>

          <div className="mt-4 space-y-3 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Mavzuning dolzarbligi</span>
              <strong>5 ball</strong>
            </div>
            <div className="flex justify-between">
              <span>Ishonchli manbalar</span>
              <strong>10 ball</strong>
            </div>
            <div className="flex justify-between">
              <span>Mustaqil tahlil</span>
              <strong>10 ball</strong>
            </div>
            <div className="flex justify-between">
              <span>Foydali xulosalar</span>
              <strong>10 ball</strong>
            </div>
            <div className="flex justify-between">
              <span>Taqdimot sifati</span>
              <strong>5 ball</strong>
            </div>
            <div className="flex justify-between border-t pt-3 text-green-800">
              <strong>Jami</strong>
              <strong>40 ball</strong>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
