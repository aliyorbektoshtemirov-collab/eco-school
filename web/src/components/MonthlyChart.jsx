import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Oylar bo'yicha o'sish — hisobot ko'rinishidagi chiziqli diagramma.
 *
 * Ma'lumot Eco Team tasdiqlagan arizalardan keladi, demo emas.
 * Tashqi kutubxona ishlatilmaydi: SVG qo'lda chiziladi, shuning uchun
 * sahifa yengil qoladi va ranglar saytning o'z palitrasiga mos tushadi.
 */

const PAPER = '#3d7ea6';
const PLASTIC = '#4f9d69';

const PAD = { top: 18, right: 14, bottom: 30, left: 46 };

/** Konteyner kengligini o'lchaymiz — matn mayda bo'lib ketmasin. */
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

/** O'q uchun chiroyli yuqori chegara: 7.3 → 8, 93 → 100, 640 → 700. */
function niceMax(value) {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
  for (const step of steps) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

const fmt = (n) => Number(n).toLocaleString('uz-UZ', { maximumFractionDigits: 1 });

export default function MonthlyChart({ months }) {
  const [wrapRef, width] = useWidth();
  const [active, setActive] = useState(null);

  const data = months ?? [];

  const totals = useMemo(() => {
    const paper = data.reduce((sum, m) => sum + m.paper, 0);
    const plastic = data.reduce((sum, m) => sum + m.plastic, 0);

    let best = null;
    for (const m of data) {
      const sum = m.paper + m.plastic;
      if (!best || sum > best.sum) best = { label: m.label, sum };
    }

    // Oxirgi ikki oyni solishtiramiz — o'sish yoki pasayish
    let change = null;
    if (data.length >= 2) {
      const prev = data[data.length - 2];
      const last = data[data.length - 1];
      const prevSum = prev.paper + prev.plastic;
      const lastSum = last.paper + last.plastic;
      if (prevSum > 0) change = Math.round(((lastSum - prevSum) / prevSum) * 100);
    }

    return { paper, plastic, all: paper + plastic, best, change };
  }, [data]);

  if (data.length === 0) return null;

  const hasData = totals.all > 0;

  const height = width < 520 ? 210 : 250;
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;

  const max = niceMax(Math.max(...data.flatMap((m) => [m.paper, m.plastic])));
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const x = (i) => PAD.left + i * stepX;
  const y = (v) => PAD.top + innerH - (v / max) * innerH;

  const line = (key) => data.map((m, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(m[key])}`).join(' ');
  const area = (key) =>
    `${line(key)} L${x(data.length - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ v: max * t, y: y(max * t) }));

  function onMove(event) {
    if (!stepX) return;
    const box = event.currentTarget.getBoundingClientRect();
    const index = Math.round((event.clientX - box.left - PAD.left) / stepX);
    setActive(Math.min(data.length - 1, Math.max(0, index)));
  }

  return (
    <section className="rounded-2xl border border-[#e3e9df] bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm font-semibold text-green-800">OYLAR BO‘YICHA</p>
          <h2 className="mt-2 text-2xl font-bold">Qayta ishlashga topshirilgan chiqindi</h2>
          <p className="mt-2 text-sm text-[#66746a]">
            Eco Team tasdiqlagan arizalar bo‘yicha, oxirgi 6 oy.
          </p>
        </div>

        <dl className="flex gap-7">
          <div>
            <dt className="text-xs text-[#8a968d]">6 oyda jami</dt>
            <dd className="mt-1 text-xl font-bold text-[#24352b]">{fmt(totals.all)} kg</dd>
          </div>
          {totals.best && totals.best.sum > 0 && (
            <div>
              <dt className="text-xs text-[#8a968d]">Eng ko‘p oy</dt>
              <dd className="mt-1 text-xl font-bold text-[#24352b]">{totals.best.label}</dd>
            </div>
          )}
          {totals.change !== null && (
            <div>
              <dt className="text-xs text-[#8a968d]">O‘tgan oyga nisbatan</dt>
              <dd
                className={`mt-1 text-xl font-bold ${
                  totals.change >= 0 ? 'text-green-700' : 'text-amber-700'
                }`}
              >
                {totals.change >= 0 ? '+' : ''}
                {totals.change}%
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div ref={wrapRef} className="relative mt-7">
        {!hasData && (
          <div className="absolute inset-0 z-10 grid place-items-center">
            <p className="rounded-xl bg-[#f7f8f3] px-5 py-3 text-sm text-[#66746a]">
              Hali tasdiqlangan ariza yo‘q — birinchi topshiruvdan keyin chiziq paydo bo‘ladi.
            </p>
          </div>
        )}

        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="Oylar bo‘yicha qog‘oz va plastik miqdori"
            onMouseMove={onMove}
            onMouseLeave={() => setActive(null)}
            className={hasData ? '' : 'opacity-35'}
          >
            <defs>
              <linearGradient id="paperFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PAPER} stopOpacity="0.16" />
                <stop offset="100%" stopColor={PAPER} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="plasticFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PLASTIC} stopOpacity="0.16" />
                <stop offset="100%" stopColor={PLASTIC} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* kg o'qi */}
            {ticks.map((tick) => (
              <g key={tick.v}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="#eef1ec"
                  strokeWidth="1"
                />
                <text
                  x={PAD.left - 10}
                  y={tick.y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#8a968d"
                >
                  {tick.v === max ? `${fmt(tick.v)} kg` : fmt(tick.v)}
                </text>
              </g>
            ))}

            {/* oy nomlari */}
            {data.map((m, i) => (
              <text
                key={m.ym}
                x={x(i)}
                y={height - 9}
                textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
                fontSize="11"
                fill={active === i ? '#24352b' : '#8a968d'}
                fontWeight={active === i ? 600 : 400}
              >
                {m.label}
              </text>
            ))}

            {hasData && (
              <>
                <path d={area('paper')} fill="url(#paperFill)" />
                <path d={area('plastic')} fill="url(#plasticFill)" />

                <path d={line('paper')} fill="none" stroke={PAPER} strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" />
                <path d={line('plastic')} fill="none" stroke={PLASTIC} strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" />

                {active !== null && (
                  <line
                    x1={x(active)}
                    x2={x(active)}
                    y1={PAD.top}
                    y2={PAD.top + innerH}
                    stroke="#c9d3c6"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                )}

                {data.map((m, i) => (
                  <g key={m.ym}>
                    <circle cx={x(i)} cy={y(m.paper)} r={active === i ? 5 : 3.5}
                            fill="#fff" stroke={PAPER} strokeWidth="2" />
                    <circle cx={x(i)} cy={y(m.plastic)} r={active === i ? 5 : 3.5}
                            fill="#fff" stroke={PLASTIC} strokeWidth="2" />
                  </g>
                ))}
              </>
            )}
          </svg>
        )}

        {hasData && active !== null && (
          <div
            className="pointer-events-none absolute top-0 rounded-xl border border-[#e3e9df] bg-white px-4 py-3 shadow-lg"
            style={{
              left: Math.min(Math.max(x(active) - 70, 0), Math.max(0, width - 150)),
            }}
          >
            <p className="text-sm font-semibold text-[#24352b]">{data[active].label}</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-[#66746a]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: PAPER }} />
              Qog‘oz
              <b className="ml-auto pl-3 text-[#24352b]">{fmt(data[active].paper)} kg</b>
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-[#66746a]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLASTIC }} />
              Plastik
              <b className="ml-auto pl-3 text-[#24352b]">{fmt(data[active].plastic)} kg</b>
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-6 border-t border-[#eef1ec] pt-5">
        <p className="flex items-center gap-2 text-sm text-[#66746a]">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: PAPER }} />
          Qog‘oz
          <b className="text-[#24352b]">{fmt(totals.paper)} kg</b>
        </p>
        <p className="flex items-center gap-2 text-sm text-[#66746a]">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLASTIC }} />
          Plastik
          <b className="text-[#24352b]">{fmt(totals.plastic)} kg</b>
        </p>
      </div>
    </section>
  );
}
