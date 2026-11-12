import { NavLink, useLocation } from 'react-router-dom';
import { inNativeShell } from '../lib/nativeShell';

/**
 * Pastki menyu — telefon ilovasidagi bilan bir xil bo'limlar.
 * Kirish, admin va sozlash sahifalarida ko'rinmaydi.
 */
const HIDDEN = ['/login', '/admin', '/setup', '/recycling-admin'];

const Icon = ({ d, extra }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
    {extra}
  </svg>
);

const TABS = [
  { to: '/', label: 'Home', icon: <Icon d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z" /> },
  { to: '/challenges', label: 'Vazifalar', icon: <Icon d="M20 6 9 17l-5-5" /> },
  { to: '/recycling', label: 'Recycling', icon: <Icon d="M7 19H4l3-5m0 0 2-3.5M7 14h5m5-9 3 5h-3m0 0-2.5 4M17 10h-5m-1 9h6l2-3.5" /> },
  { to: '/marafon', label: 'Marafon', icon: <Icon d="M5 21V4m0 0h11l-2 4 2 4H5" /> },
  { to: '/profile', label: 'Profil', icon: <Icon d="M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /> },
];

export default function TabBar() {
  const { pathname } = useLocation();
  if (inNativeShell()) return null;
  if (HIDDEN.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      aria-label="Asosiy menyu"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e2e8dd] bg-white/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `mx-1 my-1.5 flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11.5px] font-semibold transition-colors ${
                  isActive ? 'bg-[#ecf3ea] text-[#2f5d3a]' : 'text-[#6b7a6f]'
                }`
              }
            >
              {tab.icon}
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
