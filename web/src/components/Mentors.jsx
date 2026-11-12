import { useCallback, useEffect, useState } from 'react';
import { api, compressImage } from '../lib/api';

/**
 * Mentorlar bo'limi (Eco Research sahifasida).
 * Hamma ko'radi; owner mentor qo'shadi, tahrirlaydi va olib tashlaydi.
 */
export default function Mentors({ isOwner, showTitle = true }) {
  const [data, setData] = useState({ intro: '', mentors: [] });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null | {id?, fullName, title, bio, file, preview}
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api.get('/mentors'));
    } catch {
      // bo'lim ko'rinmay qolsa ham sahifa ishlayveradi
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setError('');
    setForm({ fullName: '', title: '', bio: '', file: null });
  }

  function openEdit(m) {
    setError('');
    setForm({ id: m.id, fullName: m.full_name, title: m.title || '', bio: m.bio || '', file: null });
  }

  async function save() {
    if (form.fullName.trim().length < 3) {
      setError('Ism va familiyani to‘liq yozing.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = {
        fullName: form.fullName.trim(),
        title: form.title.trim(),
        bio: form.bio.trim(),
      };
      if (form.file) {
        const small = await compressImage(form.file);
        body.photoKey = (await api.upload(small, small.type || 'image/jpeg')).key;
      }
      if (form.id) await api.put(`/admin/mentors/${form.id}`, body);
      else await api.post('/admin/mentors', body);
      setForm(null);
      await load();
    } catch (err) {
      setError(err.message || 'Saqlab bo‘lmadi.');
    }
    setBusy(false);
  }

  async function remove(m) {
    if (!window.confirm(`${m.full_name} ro‘yxatdan olib tashlansinmi?`)) return;
    try {
      await api.del(`/admin/mentors/${m.id}`);
      await load();
    } catch (err) {
      window.alert(err.message || 'O‘chirib bo‘lmadi.');
    }
  }

  if (loading) return null;
  if (!isOwner && data.mentors.length === 0 && showTitle) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between gap-3">
        {showTitle ? <h2 className="text-[22px] font-bold">Mentorlar</h2> : <span />}
        {isOwner && (
          <button
            type="button"
            onClick={openNew}
            className="rounded-xl bg-[#2f5d3a] px-4 py-2.5 text-[14px] font-semibold text-white"
          >
            + Mentor qo‘shish
          </button>
        )}
      </div>

      <p className="mt-3 rounded-2xl bg-[#ecf3ea] p-4 text-[14.5px] leading-6 text-[#2f5d3a]">
        {data.intro}
      </p>

      {data.mentors.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-[#e2e8dd] bg-white p-6 text-center text-[#6b7a6f]">
          Hozircha mentor qo‘shilmagan.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {data.mentors.map((m) => (
            <article
              key={m.id}
              className="flex gap-4 rounded-2xl border border-[#e2e8dd] bg-white p-4"
            >
              {m.has_photo ? (
                <img
                  src={`/api/mentors/files/${m.id}`}
                  alt={m.full_name}
                  loading="lazy"
                  className="h-24 w-24 shrink-0 rounded-2xl object-cover"
                />
              ) : (
                <span className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-[#ecf3ea] text-[28px] font-bold text-[#2f5d3a]">
                  {m.full_name[0]}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-[17px] font-bold">{m.full_name}</h3>
                {m.title && <p className="mt-0.5 text-[13.5px] font-semibold text-[#2f5d3a]">{m.title}</p>}
                {m.bio && <p className="mt-2 whitespace-pre-line text-[14px] leading-6 text-[#6b7a6f]">{m.bio}</p>}
                {isOwner && (
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => openEdit(m)} className="rounded-lg border border-[#e2e8dd] px-3 py-1.5 text-[13px] font-semibold">
                      Tahrirlash
                    </button>
                    <button type="button" onClick={() => remove(m)} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-[#8f4539]">
                      Olib tashlash
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <h3 className="text-[18px] font-bold">{form.id ? 'Mentorni tahrirlash' : 'Yangi mentor'}</h3>

            <label className="mt-4 block text-[13.5px] font-semibold">Ism va familiya</label>
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-[#e2e8dd] p-3 outline-none focus:border-[#2f5d3a]"
            />

            <label className="mt-4 block text-[13.5px] font-semibold">Lavozimi yoki sohasi</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Masalan: ekolog, 15 yillik tajriba"
              className="mt-1.5 w-full rounded-xl border border-[#e2e8dd] p-3 outline-none focus:border-[#2f5d3a]"
            />

            <label className="mt-4 block text-[13.5px] font-semibold">Ma’lumot</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={4}
              maxLength={1500}
              placeholder="Mentor haqida qisqacha"
              className="mt-1.5 w-full rounded-xl border border-[#e2e8dd] p-3 outline-none focus:border-[#2f5d3a]"
            />

            <label className="mt-4 block text-[13.5px] font-semibold">
              Rasm {form.id && '(almashtirish uchun yangisini tanlang)'}
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
              className="mt-1.5 block w-full text-sm"
            />

            {error && <p className="mt-3 text-[14px] text-[#8f4539]">{error}</p>}

            <div className="mt-5 flex gap-3">
              <button type="button" disabled={busy} onClick={() => setForm(null)} className="flex-1 rounded-xl border border-[#e2e8dd] py-3.5 font-semibold">
                Bekor qilish
              </button>
              <button type="button" disabled={busy} onClick={save} className="flex-[1.4] rounded-xl bg-[#2f5d3a] py-3.5 font-semibold text-white disabled:opacity-50">
                {busy ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
