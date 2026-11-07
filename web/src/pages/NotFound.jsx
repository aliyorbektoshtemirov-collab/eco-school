import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center bg-[#f5f7f0] p-6 text-[#24352b]">
      <div className="text-center">
        <p className="text-6xl font-bold text-[#315b3b]">404</p>
        <h1 className="mt-4 text-2xl font-semibold">Bu sahifa topilmadi</h1>
        <p className="mt-3 text-gray-600">
          Havola noto‘g‘ri bo‘lishi yoki sahifa ko‘chirilgan bo‘lishi mumkin.
        </p>
        <Link
          to="/"
          className="mt-7 inline-block rounded-full bg-[#315b3b] px-7 py-3.5 text-sm font-medium text-white transition hover:bg-[#25482e]"
        >
          Bosh sahifaga qaytish
        </Link>
      </div>
    </main>
  );
}
