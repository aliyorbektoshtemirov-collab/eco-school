import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

/**
 * Birinchi ishga tushirish: owner hisobini yaratadi.
 * Bazada hech kim bo'lmaganda ishlaydi, keyin o'zi yopiladi.
 */
export default function SetupPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const [needsSetup, setNeedsSetup] = useState(null);
  const [setupKey, setSetupKey] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get('/auth/setup/status')
      .then((res) => setNeedsSetup(Boolean(res.needsSetup)))
      .catch(() => setNeedsSetup(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/setup', {
        setupKey,
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        password,
      });
      await refresh();
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (needsSetup === null) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#f7f8f4]">
        <p>Tekshirilmoqda...</p>
      </main>
    );
  }

  if (needsSetup === false) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#f7f8f4] p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold text-[#28583b]">Tizim allaqachon sozlangan</h1>
          <a href="/login" className="mt-6 inline-block text-green-800 underline">
            Kirish sahifasiga o‘tish
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-[#e8eae3] bg-white p-7 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#28583b]">Birinchi sozlash</h1>
          <p className="mt-3 text-sm text-gray-500">
            Tizimning bosh egasi (owner) hisobini yarating. Bu sahifa faqat bir marta ishlaydi.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-800">Setup kaliti</label>
            <input
              type="password"
              value={setupKey}
              onChange={(e) => setSetupKey(e.target.value)}
              required
              placeholder="SETUP_KEY qiymati"
              className="w-full rounded-2xl border border-[#e1e4da] px-5 py-4 outline-none transition focus:border-[#28583b]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-800">
              Ism va familiya
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={3}
              className="w-full rounded-2xl border border-[#e1e4da] px-5 py-4 outline-none transition focus:border-[#28583b]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-800">Owner login</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoCapitalize="none"
              spellCheck="false"
              placeholder="masalan: ecoowner"
              className="w-full rounded-2xl border border-[#e1e4da] px-5 py-4 lowercase outline-none transition focus:border-[#28583b]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-800">Parol</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Kamida 8 ta belgi"
              className="w-full rounded-2xl border border-[#e1e4da] px-5 py-4 outline-none transition focus:border-[#28583b]"
            />
          </div>

          {error && (
            <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-600">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[#28583b] px-5 py-4 font-semibold text-white transition hover:bg-[#214a31] disabled:opacity-60"
          >
            {loading ? 'Kuting...' : 'Owner hisobini yaratish'}
          </button>
        </form>
      </div>
    </main>
  );
}
