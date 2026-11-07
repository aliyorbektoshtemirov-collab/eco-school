import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

/**
 * Adminlardan e'lon — sahifa boshida bitta chiziq.
 *
 * Yopilgani brauzerda eslab qolinadi, shuning uchun bir marta o'qigan
 * odamni har kirganda bezovta qilmaydi. Yangi e'lon chiqsa — qaytadan
 * ko'rinadi, chunki eslab qolingani e'lonning raqami.
 */

const KEY = 'eco:seen-announcement';

function seen() {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

function remember(id) {
  try {
    localStorage.setItem(KEY, String(id));
  } catch {
    /* shaxsiy rejimda yoki bloklangan — muhim emas */
  }
}

export default function AnnouncementBar() {
  const { user } = useAuth();
  const [item, setItem] = useState(null);

  useEffect(() => {
    // Kirmagan odamda e'lon yo'q — keraksiz so'rov ham yubormaymiz
    if (!user) {
      setItem(null);
      return undefined;
    }

    let alive = true;

    api
      .get('/announcements')
      .then((data) => {
        if (!alive) return;
        const latest = (data.announcements || [])[0];
        if (latest && latest.id > seen()) setItem(latest);
      })
      .catch(() => {
        /* kirmagan odam ko'rmaydi — xato chiqarmaymiz */
      });

    return () => {
      alive = false;
    };
  }, [user]);

  if (!item) return null;

  return (
    <div className="border-b border-[#cfe0cb] bg-[#ecf3ea]">
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-5 py-3">
        <span className="shrink-0 text-[16px] leading-6">📣</span>

        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-6 text-[#24352b]">{item.title}</p>
          {item.body && (
            <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-6 text-[#4a5c4e]">
              {item.body}
            </p>
          )}
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-[13px] font-medium text-[#2f5d3a] underline"
            >
              Batafsil
            </a>
          )}
        </div>

        <button
          type="button"
          aria-label="E'lonni yopish"
          onClick={() => {
            remember(item.id);
            setItem(null);
          }}
          className="shrink-0 rounded-lg px-2 py-1 text-[14px] text-[#6b7a6f] hover:bg-white/60 hover:text-[#24352b]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
