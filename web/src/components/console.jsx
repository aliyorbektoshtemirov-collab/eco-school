/**
 * Eco Team paneli uchun umumiy bo'laklar.
 *
 * Panel — ishchi quroli, reklama sahifasi emas: qatorlar zich, holat
 * qatorning chap chetidagi rang bilan ko'rsatiladi, ortiqcha soya yo'q.
 */

export const INK = '#1f2b22';
export const MUTED = '#6b7a6f';
export const RULE = '#e2e8dd';

/** Holat ranglari — yashil/qizil pilla emas, qatorning chap qirrasi. */
export const STATUS = {
  pending: { edge: '#c08a1e', tint: '#fdf6e6', text: '#8a5f10', label: 'Kutilmoqda' },
  approved: { edge: '#2f5d3a', tint: '#ecf3ea', text: '#2f5d3a', label: 'Tasdiqlangan' },
  rejected: { edge: '#a85a4e', tint: '#f9efed', text: '#8f4539', label: 'Rad etilgan' },
  published: { edge: '#2f5d3a', tint: '#ecf3ea', text: '#2f5d3a', label: 'Nashr qilindi' },
};

export const statusOf = (key) => STATUS[key] ?? STATUS.pending;

/** Sanani o'zbekcha qisqa ko'rinishda: "4-noy, 16:04". */
const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

export function shortDate(value) {
  if (!value) return '';
  const d = new Date(String(value).replace(' ', 'T') + (String(value).endsWith('Z') ? '' : 'Z'));
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${time}`;
}

/** Sinf belgisi — ism yonidagi kichik qat'iy blok. */
export function ClassTag({ children }) {
  if (!children) return null;
  return (
    <span className="shrink-0 rounded-md bg-[#eef2ea] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-[#4a5c4e]">
      {children}
    </span>
  );
}

/** Hisoblagich — bosilganda bo'lim almashadi, demak bezak emas. */
export function CounterTab({ active, label, value, tone = 'ink', onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`min-w-[112px] shrink-0 border-b-2 px-4 py-4 text-left transition-colors ${
        active
          ? 'border-[#2f5d3a] bg-white'
          : 'border-transparent bg-transparent hover:bg-white/60'
      }`}
    >
      <span
        className={`block text-[26px] font-bold leading-none tabular-nums ${
          tone === 'warn' && value > 0 ? 'text-[#8a5f10]' : 'text-[#1f2b22]'
        }`}
      >
        {value}
      </span>
      <span className="mt-1.5 block text-[13px] text-[#6b7a6f]">{label}</span>
    </button>
  );
}

/** Filtr tugmalari — faqat matn, qo'shimcha bezaksiz. */
export function Segmented({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-[#eef2ea] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
            value === opt.value
              ? 'bg-white text-[#1f2b22] shadow-[0_1px_2px_rgba(31,43,34,0.08)]'
              : 'text-[#6b7a6f] hover:text-[#1f2b22]'
          }`}
        >
          {opt.label}
          {opt.count != null && (
            <span className="ml-1.5 tabular-nums opacity-60">{opt.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Ikki bosqichli tasdiq: modal oynasiz, o'sha qatorning o'zida.
 * Navbatni tez ko'rib chiqishga xalaqit bermaydi.
 */
export function ConfirmAction({
  idle,
  question,
  onConfirm,
  busy,
  armed,
  onArm,
  onCancel,
  tone = 'green',
  quiet = false,
}) {
  if (armed) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-[13px] text-[#6b7a6f]">{question}</span>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50 ${
            tone === 'red' ? 'bg-[#a85a4e]' : 'bg-[#2f5d3a]'
          }`}
        >
          {busy ? '...' : 'Ha'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-[13px] text-[#6b7a6f] hover:text-[#1f2b22]"
        >
          Yo‘q
        </button>
      </span>
    );
  }

  // Kamdan-kam bosiladigan amallar jim turadi — ro'yxat tugmalar devoriga
  // aylanib ketmasin. Rang faqat tasdiq bosqichida paydo bo'ladi.
  if (quiet) {
    return (
      <button
        type="button"
        onClick={() => onArm()}
        className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
          tone === 'red'
            ? 'text-[#6b7a6f] hover:bg-[#f9efed] hover:text-[#8f4539]'
            : 'text-[#2f5d3a] hover:bg-[#ecf3ea]'
        }`}
      >
        {idle}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onArm()}
      className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors ${
        tone === 'red'
          ? 'border border-[#e6cfca] text-[#8f4539] hover:bg-[#f9efed]'
          : 'bg-[#2f5d3a] text-white hover:bg-[#285032]'
      }`}
    >
      {idle}
    </button>
  );
}

export function EmptyState({ title, hint }) {
  return (
    <div className="rounded-xl border border-dashed border-[#d6ded1] px-6 py-14 text-center">
      <p className="text-[15px] font-medium text-[#1f2b22]">{title}</p>
      {hint && <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-[#6b7a6f]">{hint}</p>}
    </div>
  );
}

export function Notice({ kind = 'info', children, onClose }) {
  if (!children) return null;
  const tone =
    kind === 'error'
      ? 'border-[#e6cfca] bg-[#f9efed] text-[#8f4539]'
      : 'border-[#cfe0cb] bg-[#ecf3ea] text-[#2f5d3a]';

  return (
    <div className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-[14px] ${tone}`}>
      <span className="flex-1">{children}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="shrink-0 opacity-50 hover:opacity-100">
          ✕
        </button>
      )}
    </div>
  );
}
