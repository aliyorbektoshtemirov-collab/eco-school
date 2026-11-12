import { useEffect, useState } from 'react';
import { api, fileUrl } from '../lib/api';

export default function RecyclingAdminPage() {
  const [rates, setRates] = useState(null);
  const [savingRates, setSavingRates] = useState(false);
  const [ratesMessage, setRatesMessage] = useState('');
  useEffect(() => { api.get('/recycling/rates').then(data => setRates(data.rates)).catch(err => setRatesMessage(err.message)); }, []);
  async function saveRates(event) {
    event.preventDefault(); setSavingRates(true); setRatesMessage('');
    try {
      const result = await api.put('/recycling/admin/rates', { paper: Number(rates.paper), plastic: Number(rates.plastic) });
      setRates(result.rates); setRatesMessage(result.message);
    } catch (err) { setRatesMessage(err.message); }
    finally { setSavingRates(false); }
  }
  const [items, setItems] = useState([]);
  const [weights, setWeights] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [workingId, setWorkingId] = useState(null);

  async function loadItems() {
    setLoading(true);
    setMessage('');

    try {
      const data = await api.get('/recycling/admin/list');
      const list = data.items || [];
      setItems(list);

      setWeights((previous) => {
        const next = { ...previous };
        list.forEach((item) => {
          if (next[item.id] === undefined) next[item.id] = String(item.amount_kg);
        });
        return next;
      });
    } catch (error) {
      if (error.status === 401) {
        setMessage('Avval tizimga kiring.');
      } else if (error.status === 403) {
        setMessage('Bu sahifaga faqat admin kira oladi.');
      } else {
        setMessage('Yuklashda xatolik: ' + error.message);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadItems();
  }, []);

  async function review(id, status) {
    setMessage('');

    const verifiedWeight = Number(weights[id]);

    if (status === 'approved' && (!Number.isFinite(verifiedWeight) || verifiedWeight <= 0)) {
      setMessage('Iltimos, haqiqiy vaznni to‘g‘ri kiriting.');
      return;
    }

    setWorkingId(id);

    try {
      const res = await api.post(`/recycling/admin/${id}/review`, {
        status,
        verifiedAmountKg: status === 'approved' ? verifiedWeight : undefined,
      });
      setMessage(res.message);
      await loadItems();
    } catch (error) {
      setMessage('Tasdiqlashda xatolik: ' + error.message);
    }

    setWorkingId(null);
  }

  const pendingCount = items.filter((item) => item.status === 'pending').length;

  return (
    <main className="min-h-screen bg-[#f7f8f3] px-5 py-10 text-[#24352b]">
      <div className="mx-auto max-w-4xl">
        <a href="/recycling" className="text-sm font-medium text-green-800">
          ← Recycling sahifasi
        </a>

        <header className="mb-8 mt-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-green-700">
            ECO SCHOOL · ECO TEAM
          </p>

          <h1 className="mt-3 text-4xl font-bold">Recycling nazorati</h1>

          <p className="mt-3 text-[#66746a]">
            O‘quvchi topshirgan chiqindilarni tekshiring va haqiqiy vaznini tasdiqlang.
          </p>
        </header>

        <form onSubmit={saveRates} className="mb-6 rounded-3xl border border-green-100 bg-white p-6">
          <h2 className="text-xl font-bold">1 kg uchun eco ball</h2>
          <p className="mt-2 text-sm text-gray-500">Maktabingiz uchun belgilang. Avval berilgan ball o‘zgarmaydi; yangi tarif keyingi tasdiqlashlarga qo‘llanadi.</p>
          {rates && <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {['paper', 'plastic'].map(material => <label key={material} className="text-sm font-semibold">
              {material === 'paper' ? '📄 Qog‘oz' : '♻️ Plastik'}
              <input type="number" min="1" max="10000" step="1" required value={rates[material]} onChange={e => setRates({ ...rates, [material]: e.target.value })} className="mt-2 block w-full rounded-xl border p-3" />
            </label>)}
          </div>}
          <button disabled={!rates || savingRates} className="mt-4 rounded-xl bg-green-800 px-5 py-3 font-semibold text-white disabled:opacity-50">{savingRates ? 'Saqlanmoqda…' : 'Ballni saqlash'}</button>
          {ratesMessage && <p role="status" className="mt-3 text-sm">{ratesMessage}</p>}
        </form>
        <div className="mb-6 rounded-2xl border border-green-100 bg-white p-5">
          <p className="text-sm text-gray-500">Kutilayotgan topshiriqlar</p>
          <p className="mt-1 text-3xl font-bold text-green-800">{pendingCount}</p>
        </div>

        {message && (
          <p className="mb-5 rounded-xl bg-green-50 p-4 text-sm text-green-900">{message}</p>
        )}

        {loading ? (
          <p>Yuklanmoqda...</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-gray-500">
            Hozircha topshiriqlar mavjud emas.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-[#e3e9df] bg-white p-5"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{item.full_name || 'O‘quvchi'}</h2>
                    <p className="text-sm text-gray-500">
                      {item.class_name || 'Sinf ko‘rsatilmagan'}
                    </p>
                  </div>

                  <span className="h-fit rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-800">
                    {item.status === 'pending'
                      ? 'Tekshirilmoqda'
                      : item.status === 'approved'
                        ? 'Tasdiqlandi'
                        : 'Rad etildi'}
                  </span>
                </div>

                <div className="mt-5 rounded-xl bg-[#f7f8f3] p-4">
                  <p className="font-semibold">
                    {item.material === 'paper' ? '📄 Qog‘oz' : '♻️ Plastik'}
                  </p>

                  {item.proof_image && (
                    <img
                      src={fileUrl(item.proof_image, true)}
                      alt="Tarozi rasmi"
                      className="mt-4 max-h-72 rounded-xl object-contain"
                    />
                  )}

                  <p className="mt-3 text-sm text-gray-500">O‘quvchi kiritgan vazn</p>
                  <p className="text-xl font-bold">{item.amount_kg} kg</p>

                  {item.status === 'pending' && (
                    <div className="mt-4">
                      <label className="block text-sm font-semibold">
                        Eco Team tasdiqlagan haqiqiy vazn (kg)
                      </label>

                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={weights[item.id] ?? ''}
                        onChange={(e) =>
                          setWeights((previous) => ({
                            ...previous,
                            [item.id]: e.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-green-700"
                        placeholder="Masalan: 1.25"
                      />
                    </div>
                  )}

                  {item.status === 'approved' && (
                    <>
                      <p className="mt-3 text-sm text-gray-500">Tasdiqlangan haqiqiy vazn</p>
                      <p className="text-xl font-bold text-green-800">
                        {item.verified_amount_kg ?? '—'} kg
                      </p>
                    </>
                  )}

                  <p className="mt-3 text-xs text-gray-500">
                    {new Date(item.submitted_at.replace(' ', 'T') + 'Z').toLocaleString('uz-UZ')}
                  </p>
                </div>

                {item.status === 'pending' && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      disabled={workingId === item.id}
                      onClick={() => review(item.id, 'approved')}
                      className="rounded-xl bg-green-800 px-5 py-3 font-semibold text-white disabled:opacity-50"
                    >
                      {workingId === item.id ? 'Kutilmoqda...' : 'Vaznni tasdiqlash'}
                    </button>

                    <button
                      disabled={workingId === item.id}
                      onClick={() => review(item.id, 'rejected')}
                      className="rounded-xl border border-red-200 px-5 py-3 font-semibold text-red-700 disabled:opacity-50"
                    >
                      Rad etish
                    </button>
                  </div>
                )}

                {item.status === 'approved' && (
                  <p className="mt-4 font-semibold text-green-700">
                    +{item.awarded_points} ball berildi
                  </p>
                )}
              </article>
            ))}
          </div>
        )}

        <button
          onClick={loadItems}
          disabled={loading}
          className="mt-6 rounded-xl border border-gray-200 bg-white px-5 py-3 font-medium disabled:opacity-50"
        >
          Yangilash
        </button>
      </div>
    </main>
  );
}
