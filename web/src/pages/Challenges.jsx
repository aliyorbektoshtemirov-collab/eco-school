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
    return <main className="p-10 text-[#6b7a6f]">Yuklanmoqda...</main>;
  }

  const STATUS = {
    approved: ['Tasdiqlangan', 'bg-[#ecf3ea] text-[#2f5d3a]'],
    rejected: ['Rad etilgan', 'bg-[#f9efed] text-[#8f4539]'],
    pending: ['Tekshirilmoqda', 'bg-[#fdf6e6] text-[#8a5f10]'],
  };

  return (
    <main className="min-h-screen bg-[#f3f5ef]">
      <div className="sticky top-0 z-30 border-b border-[#e2e8dd] bg-white">
        <div className="mx-auto max-w-xl px-4 py-4">
          <h1 className="text-[18px] font-bold text-[#1f2b22]">Vazifalar</h1>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-4 py-4">
        {error && <p className="mb-3 rounded-xl bg-red-50 p-4 text-[#8f4539]">{error}</p>}
        {message && !selected && (
          <p className="mb-3 rounded-xl bg-[#ecf3ea] p-4 text-[#2f5d3a]">{message}</p>
        )}

        {challenges.length === 0 && !error && (
          <div className="rounded-2xl border border-[#e2e8dd] bg-white p-8 text-center text-[#6b7a6f]">
            Hozircha ochiq vazifa yo‘q.
          </div>
        )}

        <div className="space-y-3">
          {challenges.map((challenge) => {
            const submission = submissions.find((item) => item.challenge_id === challenge.id);
            const [label, tone] = STATUS[submission?.status] || STATUS.pending;

            return (
              <article
                key={challenge.id}
                className="rounded-2xl border border-[#e2e8dd] bg-white p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-md bg-[#eef2ea] px-2 py-1 text-[12px] font-semibold text-[#4a5c4e]">
                    {challenge.category}
                  </span>
                  <span className="rounded-full bg-[#ecf3ea] px-3 py-1 text-[13px] font-bold text-[#2f5d3a]">
                    +{challenge.points} ball
                  </span>
                </div>

                <h2 className="mt-3 text-[17px] font-bold text-[#1f2b22]">{challenge.title}</h2>
                {challenge.description && (
                  <p className="mt-1.5 text-[14px] leading-6 text-[#6b7a6f]">
                    {challenge.description}
                  </p>
                )}
                {challenge.end_date && (
                  <p className="mt-2 text-[12.5px] text-[#9aa89d]">
                    Tugash sanasi: {challenge.end_date}
                  </p>
                )}

                {submission ? (
                  <div className={`mt-4 rounded-xl px-4 py-3 text-[14px] font-semibold ${tone}`}>
                    {label}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setSelected(challenge);
                      setMessage('');
                    }}
                    className="mt-4 w-full rounded-xl bg-[#2f5d3a] py-3.5 text-[15px] font-semibold text-white active:bg-[#285032]"
                  >
                    Men bajardim
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <h2 className="text-[18px] font-bold text-[#1f2b22]">Topshiriq yuborish</h2>
            <p className="mt-1 text-[14px] text-[#6b7a6f]">{selected.title}</p>

            <label className="mt-5 block text-[13.5px] font-semibold text-[#1f2b22]">
              Qanday bajardingiz?
            </label>
            <textarea
              value={proofText}
              onChange={(event) => setProofText(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Bajargan ishingiz haqida yozing..."
              className="mt-2 w-full rounded-xl border border-[#e2e8dd] p-3 outline-none focus:border-[#2f5d3a]"
            />

            <label className="mt-4 block text-[13.5px] font-semibold text-[#1f2b22]">
              Rasm (ixtiyoriy)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setProofFile(event.target.files?.[0] || null)}
              className="mt-2 block w-full text-sm"
            />
            {proofFile && (
              <p className="mt-2 text-[13px] text-[#6b7a6f]">Tanlandi: {proofFile.name}</p>
            )}

            {message && <p className="mt-4 text-[14px] text-[#8f4539]">{message}</p>}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setSelected(null)}
                disabled={sending}
                className="flex-1 rounded-xl border border-[#e2e8dd] py-3.5 font-semibold text-[#1f2b22]"
              >
                Bekor qilish
              </button>
              <button
                onClick={submitChallenge}
                disabled={sending}
                className="flex-[1.4] rounded-xl bg-[#2f5d3a] py-3.5 font-semibold text-white disabled:opacity-50"
              >
                {sending ? 'Yuborilmoqda...' : 'Yuborish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
