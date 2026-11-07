import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const [mode, setMode] = useState('register');

  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [classes, setClasses] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadClasses(code) {
    const normalizedCode = code.trim().toUpperCase();

    setSchoolCode(normalizedCode);
    setClasses([]);
    setClassName('');
    setError('');
    setMessage('');

    if (!normalizedCode) {
      setError('Avval maktab kodini kiriting.');
      return;
    }

    setLoading(true);

    try {
      const data = await api.get(`/auth/classes?code=${encodeURIComponent(normalizedCode)}`);
      const list = data.classes ?? [];
      setClasses(list);

      if (list.length === 0) {
        setError('Maktab kodi topilmadi yoki sinflar hali kiritilmagan.');
        return;
      }

      setMessage(`${list.length} ta sinf muvaffaqiyatli yuklandi.`);
    } catch (err) {
      console.error('Class loading error:', err);
      setError('Sinflarni yuklashda xatolik: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!name.trim()) {
          setError('Ism va familiyangizni kiriting.');
          return;
        }

        if (!schoolCode.trim()) {
          setError('Maktab kodini kiriting.');
          return;
        }

        if (!className) {
          setError('Iltimos, sinfingizni tanlang.');
          return;
        }

        if (!classes.some((item) => item.class_name === className)) {
          setError('Iltimos, maktab sinflarini qayta yuklang.');
          return;
        }

        await api.post('/auth/register', {
          fullName: name.trim(),
          username: username.trim().toLowerCase(),
          password,
          schoolCode: schoolCode.trim().toUpperCase(),
          className,
        });

        await refresh();
        setMessage('Ro‘yxatdan muvaffaqiyatli o‘tdingiz!');
        navigate('/profile');
      } else {
        await api.post('/auth/login', {
          username: username.trim().toLowerCase(),
          password,
        });

        await refresh();
        navigate('/profile');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(
        mode === 'register'
          ? 'Ro‘yxatdan o‘tishda xatolik: ' + err.message
          : err.message || 'Login yoki parol noto‘g‘ri. Qayta urinib ko‘ring.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-sm border border-[#e8eae3]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#28583b]">ECO SCHOOL</h1>

          <p className="mt-3 text-sm text-gray-500">
            Ekologik o‘zgarishlarning bir qismiga aylaning.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-2 rounded-2xl bg-[#f1f2ed] p-1">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
              setMessage('');
            }}
            className={`rounded-xl px-3 py-4 text-sm font-medium transition ${
              mode === 'register' ? 'bg-white text-[#28583b] shadow-sm' : 'text-gray-500'
            }`}
          >
            Ro‘yxatdan o‘tish
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              setMessage('');
            }}
            className={`rounded-xl px-3 py-4 text-sm font-medium transition ${
              mode === 'login' ? 'bg-white text-[#28583b] shadow-sm' : 'text-gray-500'
            }`}
          >
            Kirish
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'register' && (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-800">
                  Ism va familiya
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ismingizni kiriting"
                  required
                  className="w-full rounded-2xl border border-[#e1e4da] px-5 py-4 outline-none transition focus:border-[#28583b]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-800">
                  Maktab kodi
                </label>

                <input
                  type="text"
                  value={schoolCode}
                  onChange={(e) => {
                    setSchoolCode(e.target.value.toUpperCase());
                    setClasses([]);
                    setClassName('');
                    setError('');
                    setMessage('');
                  }}
                  placeholder="Maktab kodini kiriting"
                  required
                  className="w-full rounded-2xl border border-[#e1e4da] px-5 py-4 uppercase outline-none transition focus:border-[#28583b]"
                />

                <button
                  type="button"
                  onClick={() => loadClasses(schoolCode)}
                  disabled={loading}
                  className="mt-2 text-sm font-medium text-[#28583b] hover:underline disabled:opacity-50"
                >
                  {loading ? 'Yuklanmoqda...' : 'Sinflarni yuklash'}
                </button>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-800">
                  Sinfingiz
                </label>

                <select
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  disabled={classes.length === 0}
                  required
                  className="w-full rounded-2xl border border-[#e1e4da] bg-[#f1f2ed] px-5 py-4 outline-none transition focus:border-[#28583b] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <option value="">
                    {classes.length > 0 ? 'Sinfingizni tanlang' : 'Avval maktab kodini kiriting'}
                  </option>

                  {classes.map((item) => (
                    <option key={item.class_name} value={item.class_name}>
                      {item.class_name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-800">Login</label>

            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="masalan: aziza2012"
              autoCapitalize="none"
              spellCheck="false"
              required
              className="w-full rounded-2xl border border-[#e1e4da] px-5 py-4 lowercase outline-none transition focus:border-[#28583b]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-800">Parol</label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Kamida 8 ta belgi"
              minLength={8}
              required
              className="w-full rounded-2xl border border-[#e1e4da] px-5 py-4 outline-none transition focus:border-[#28583b]"
            />
          </div>

          {error && (
            <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-600">{error}</div>
          )}

          {message && (
            <div className="rounded-2xl bg-green-50 p-4 text-sm text-[#28583b]">{message}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[#28583b] px-5 py-4 font-semibold text-white transition hover:bg-[#214a31] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Kuting...' : mode === 'register' ? 'Ro‘yxatdan o‘tish' : 'Kirish'}
          </button>
        </form>
      </div>
    </main>
  );
}
