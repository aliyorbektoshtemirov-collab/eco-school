import { NavLink, useLocation } from 'react-router-dom';

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
  { to: '/', label: 'Bosh', end: true, icon: <Icon d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-6h4v6" /> },
  { to: '/challenges', label: 'Vazifalar', icon: <Icon d="M20 6 9 17l-5-5" /> },
  { to: '/marafon', label: 'Marafon', icon: <Icon d="M5 21V4m0 0h11l-2 4 2 4H5" /> },
  { to: '/recycling', label: 'Recycling', icon: <Icon d="M7 19H4l3-5m0 0 2-3.5M7 14h5m5-9 3 5h-3m0 0-2.5 4M17 10h-5m-1 9h6l2-3.5" /> },
  { to: '/mentors', label: 'Mentorlar', icon: <Icon d="M22 10 12 5 2 10l10 5 10-5ZM6 12v5c3 2.5 9 2.5 12 0v-5" /> },
  { to: '/leaderboard', label: 'Reyting', icon: <Icon d="M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0V4Zm0 2H4v2a3 3 0 0 0 3 3m10-5h3v2a3 3 0 0 1-3 3" /> },
  { to: '/profile', label: 'Profil', icon: <Icon d="M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /> },
];

export default function TabBar() {
  const { pathname } = useLocation();
  if (HIDDEN.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      aria-label="Asosiy menyu"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e2e8dd] bg-white/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `mx-0.5 my-1.5 flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10px] sm:text-[11.5px] font-semibold transition-colors ${
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
