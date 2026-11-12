import { useEffect, useState } from 'react';
import { api, compressImage } from '../lib/api';

export default function RecyclingPage() {
  const [rates, setRates] = useState(null);
  const [material, setMaterial] = useState('paper');
  const [amount, setAmount] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);

  async function loadSubmissions() {
    try {
      const data = await api.get('/recycling');
      setSubmissions(data.submissions || []);
      setRates(data.rates);
    } catch (error) {
      if (error.status !== 401) {
        setMessage("Ma'lumotlarni yuklashda xatolik: " + error.message);
        setMessageIsError(true);
      }
      setSubmissions([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadSubmissions();
  }, []);

  async function submitRecycling(e) {
    e.preventDefault();
    setMessage('');
    setMessageIsError(false);

    const kg = Number(amount);

    if (!Number.isFinite(kg) || kg <= 0) {
      setMessage('Iltimos, to‘g‘ri vazn kiriting.');
      setMessageIsError(true);
      return;
    }

    if (!proofFile) {
      setMessage('Iltimos, tarozi rasmini yuklang.');
      setMessageIsError(true);
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(proofFile.type)) {
      setMessage('Faqat JPG, PNG yoki WEBP formatidagi rasm yuklang.');
      setMessageIsError(true);
      return;
    }

    if (proofFile.size > 5 * 1024 * 1024) {
      setMessage('Rasm hajmi 5 MB dan oshmasligi kerak.');
      setMessageIsError(true);
      return;
    }

    setSending(true);

    try {
      const compressed = await compressImage(proofFile);
      const uploaded = await api.upload(compressed, compressed.type || 'image/jpeg');

      const res = await api.post('/recycling', {
        material,
        amountKg: kg,
        proofImage: uploaded.key,
      });

      setMessage(res.message || 'Topshirig‘ingiz yuborildi! Eco Team tasdiqlashini kuting.');
      setMessageIsError(false);
      setAmount('');
      setProofFile(null);

      const fileInput = document.getElementById('proof-image');
      if (fileInput) fileInput.value = '';

      await loadSubmissions();
    } catch (error) {
      setMessage(error.message || 'Kutilmagan xatolik yuz berdi. Qayta urinib ko‘ring.');
      setMessageIsError(true);
    } finally {
      setSending(false);
    }
  }

  const statusText = {
    pending: 'Tekshirilmoqda',
    approved: 'Tasdiqlandi',
    rejected: 'Rad etildi',
  };

  return (
    <main className="min-h-screen bg-[#f7f8f3] px-5 py-10 text-[#24352b]">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="text-sm font-medium text-green-800">
          ← Bosh sahifa
        </a>

        <header className="mb-8 mt-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-green-700">
            ECO SCHOOL · RECYCLING
          </p>

          <h1 className="mt-3 text-4xl font-bold">Chiqindini resursga aylantiring.</h1>

          <p className="mt-3 text-[#66746a]">
            Qog‘oz va plastikni qayta ishlashga topshiring, natijangizni maktab
            ekologik ta’siriga qo‘shing.
          </p>
        </header>

        <form
          onSubmit={submitRecycling}
          className="rounded-3xl border border-[#e3e9df] bg-white p-6 shadow-sm"
        >
          <h2 className="text-xl font-semibold">Yangi topshiruv</h2>
          <p className="mt-3 rounded-2xl bg-green-50 p-4 text-sm text-green-900">♻️ Har bir kilogramm — toza maktab sari qadam. Ballni maktab adminlari belgilaydi.</p>
          {rates && Number(amount) > 0 && Number(amount) <= 1000 && <p className="mt-3 text-lg font-bold text-green-800">Taxminan +{Math.round(Number(amount) * rates[material])} eco ball! <span className="block text-xs font-normal">Yakuniy ball tasdiqlangan vazn va tasdiqlash paytidagi tarifga bog‘liq.</span></p>}

          <p className="mb-3 mt-5 text-sm font-medium">Chiqindi turi</p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMaterial('paper')}
              className={`rounded-2xl border p-4 text-left ${
                material === 'paper' ? 'border-green-700 bg-green-50' : 'border-gray-200'
              }`}
            >
              <span className="text-3xl">📄</span>
              <span className="mt-2 block font-semibold">Qog‘oz</span>
              <span className="text-sm text-gray-500">{rates ? `1 kg = ${rates.paper} ball` : 'Ball yuklanmoqda…'}</span>
            </button>

            <button
              type="button"
              onClick={() => setMaterial('plastic')}
              className={`rounded-2xl border p-4 text-left ${
                material === 'plastic' ? 'border-green-700 bg-green-50' : 'border-gray-200'
              }`}
            >
              <span className="text-3xl">♻️</span>
              <span className="mt-2 block font-semibold">Plastik</span>
              <span className="text-sm text-gray-500">{rates ? `1 kg = ${rates.plastic} ball` : 'Ball yuklanmoqda…'}</span>
            </button>
          </div>

          <label className="mb-2 mt-6 block text-sm font-medium">Vazn (kg)</label>

          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Masalan: 2.5"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-700"
            required
          />

          <label htmlFor="proof-image" className="mb-2 mt-6 block text-sm font-medium">
            Tarozi rasmi
          </label>

          <div className="rounded-2xl border-2 border-dashed border-green-200 bg-green-50/50 p-5">
            <input
              id="proof-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
              required
            />

            <p className="mt-3 text-xs text-gray-600">
              Rasmda chiqindi va tarozidagi kilogramm ko‘rsatkichi aniq ko‘rinishi
              kerak. Maksimal hajm: 5 MB.
            </p>

            {proofFile && (
              <p className="mt-2 text-sm font-medium text-green-800">
                Tanlangan rasm: {proofFile.name}
              </p>
            )}
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Eco Team rasmni tekshiradi va tasdiqlangan vazn asosida ball hisoblanadi.
          </p>

          <button
            type="submit"
            disabled={sending}
            className="mt-6 w-full rounded-xl bg-green-800 px-5 py-3 font-semibold text-white transition hover:bg-green-900 disabled:opacity-50"
          >
            {sending ? 'Yuborilmoqda...' : 'Topshiruvni yuborish'}
          </button>

          {message && (
            <p
              role="status"
              className={`mt-4 rounded-xl p-3 text-sm ${
                messageIsError ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-900'
              }`}
            >
              {message}
            </p>
          )}
        </form>

        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-bold">Mening topshiriqlarim</h2>

          {loading ? (
            <p className="text-gray-500">Yuklanmoqda...</p>
          ) : submissions.length === 0 ? (
            <p className="rounded-2xl bg-white p-5 text-gray-500">
              Hozircha topshiriqlar yo‘q.
            </p>
          ) : (
            <div className="space-y-3">
              {submissions.map((item) => (
                <article
                  key={item.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-[#e3e9df] bg-white p-5"
                >
                  <div>
                    <p className="font-semibold">
                      {item.material === 'paper' ? '📄 Qog‘oz' : '♻️ Plastik'}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">{item.amount_kg} kg</p>

                    <p className="mt-1 text-xs text-gray-400">
                      {new Date(item.submitted_at.replace(' ', 'T') + 'Z').toLocaleDateString('uz-UZ')}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-medium">{statusText[item.status]}</p>

                    {item.status === 'approved' && (
                      <p className="mt-1 font-bold text-green-700">
                        +{item.awarded_points} ball
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
