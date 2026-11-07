import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, compressImage } from '../lib/api';

export default function ChallengesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [challenges, setChallenges] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [proofText, setProofText] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  async function loadData() {
    try {
      const data = await api.get('/challenges');
      setChallenges(data.challenges || []);
      setSubmissions(data.submissions || []);
    } catch (err) {
      if (err.status === 401) {
        navigate('/login');
        return;
      }
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Botdagi «Bajarish» tugmasi ?open=<id> bilan keladi — o'sha vazifani ochamiz
  useEffect(() => {
    const id = Number(params.get('open'));
    if (!id || challenges.length === 0) return;

    const target = challenges.find((item) => item.id === id);
    const done = submissions.some((item) => item.challenge_id === id);

    if (target && !done) setSelected(target);

    params.delete('open');
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenges, submissions]);

  async function submitChallenge() {
    if (!selected) return;

    if (!proofText.trim() && !proofFile) {
      setMessage('Iltimos, izoh yoki rasm qo‘shing.');
      return;
    }

    if (proofFile) {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];

      if (!allowed.includes(proofFile.type)) {
        setMessage('Faqat JPG, PNG yoki WebP rasm yuklang.');
        return;
      }

      if (proofFile.size > 50 * 1024 * 1024) {
        setMessage('Rasm hajmi 50 MB dan oshmasligi kerak.');
        return;
      }
    }

    setSending(true);
    setMessage('');

    try {
      let proofUrl = null;

      if (proofFile) {
        const compressed = await compressImage(proofFile);
        const uploaded = await api.upload(compressed, compressed.type || 'image/jpeg');
        proofUrl = uploaded.key;
      }

      const res = await api.post(`/challenges/${selected.id}/submit`, {
        proofText: proofText.trim() || undefined,
        proofUrl: proofUrl || undefined,
      });

      setMessage(res.message || 'Topshirig‘ingiz yuborildi! Tekshiruvdan so‘ng natija chiqadi.');
      setProofText('');
      setProofFile(null);
      setSelected(null);

      await loadData();
    } catch (err) {
      console.error('SUBMISSION ERROR:', err);
      setMessage(err.message || 'Yuborishda xatolik yuz berdi.');
    } finally {
      setSending(false);
    }
  }

  function statusLabel(status) {
    if (status === 'approved') return 'Tasdiqlangan';
    if (status === 'rejected') return 'Rad etilgan';
    return 'Tekshirilmoqda';
  }

  if (loading) {
    return <main className="p-10">Yuklanmoqda...</main>;
  }

  return (
    <main className="min-h-screen bg-[#f5f7f0] px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <a href="/" className="text-sm text-green-800 hover:underline">
          ← Bosh sahifa
        </a>

        <header className="mt-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-green-700">
            ECO SCHOOL
          </p>
          <h1 className="mt-3 text-4xl font-bold text-[#253b2b]">Eco Challenges</h1>
          <p className="mt-4 text-gray-600">
            Har bir kichik harakatingiz maktabingiz uchun ijobiy o‘zgarishdir.
          </p>
        </header>

        {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}

        {message && <p className="mt-6 rounded-xl bg-green-50 p-4 text-green-800">{message}</p>}

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          {challenges.map((challenge) => {
            const submission = submissions.find((item) => item.challenge_id === challenge.id);

            return (
              <article
                key={challenge.id}
                className="rounded-3xl border border-[#e5e9df] bg-white p-7 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-green-50 px-4 py-2 text-sm text-green-800">
                    {challenge.category}
                  </span>
                  <span className="font-semibold text-green-800">
                    +{challenge.points} ball
                  </span>
                </div>

                <h2 className="mt-6 text-2xl font-semibold text-[#253b2b]">
                  {challenge.title}
                </h2>
                <p className="mt-3 leading-7 text-gray-600">{challenge.description}</p>

                {challenge.end_date && (
                  <p className="mt-4 text-sm text-gray-500">
                    Tugash sanasi: {challenge.end_date}
                  </p>
                )}

                {submission ? (
                  <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                    Holat: {statusLabel(submission.status)}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setSelected(challenge);
                      setMessage('');
                    }}
                    className="mt-6 rounded-xl bg-[#315b3b] px-6 py-3 font-medium text-white hover:bg-[#25482e]"
                  >
                    Men bajardim
                  </button>
                )}
              </article>
            );
          })}
        </section>

        {selected && (
          <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4">
            <div className="my-8 w-full max-w-lg rounded-3xl bg-white p-7 shadow-xl">
              <h2 className="text-2xl font-bold text-[#253b2b]">Challenge topshirish</h2>
              <p className="mt-2 text-gray-600">{selected.title}</p>

              <label className="mt-6 block text-sm font-medium text-gray-700">
                Qanday bajardingiz?
              </label>
              <textarea
                value={proofText}
                onChange={(event) => setProofText(event.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Bajargan ishingiz haqida yozing..."
                className="mt-2 w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-green-700"
              />

              <label className="mt-5 block text-sm font-medium text-gray-700">
                Rasm dalili (ixtiyoriy)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setProofFile(event.target.files?.[0] || null)}
                className="mt-2 block w-full text-sm"
              />

              {proofFile && (
                <p className="mt-2 text-sm text-gray-500">
                  Tanlangan fayl: {proofFile.name}
                </p>
              )}

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  onClick={() => setSelected(null)}
                  disabled={sending}
                  className="rounded-xl border border-gray-200 px-5 py-3 text-gray-700"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={submitChallenge}
                  disabled={sending}
                  className="rounded-xl bg-[#315b3b] px-5 py-3 font-medium text-white disabled:opacity-50"
                >
                  {sending ? 'Yuborilmoqda...' : 'Yuborish'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
