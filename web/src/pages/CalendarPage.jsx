import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

const typeLabels = {
  event: 'Tadbir',
  challenge: 'Challenge',
  eco_day: 'Ekologik kun',
};

const typeColors = {
  event: 'bg-blue-100 text-blue-800',
  challenge: 'bg-green-100 text-green-800',
  eco_day: 'bg-amber-100 text-amber-800',
};

export default function CalendarPage() {
  const { isAdmin } = useAuth();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [month, setMonth] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('event');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');

  async function loadEvents() {
    setLoading(true);
    setMessage('');

    try {
      const data = await api.get('/events');
      setEvents(data.events || []);
    } catch (error) {
      if (error.status === 401) {
        setMessage('Tadbirlarni ko‘rish uchun tizimga kiring.');
      } else {
        setMessage('Tadbirlarni yuklashda xatolik: ' + error.message);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    setMonth(new Date());
    loadEvents();
  }, []);

  if (!month) {
    return (
      <main className="min-h-screen bg-[#f7f8f3] p-10 text-center text-[#24352b]">
        Calendar yuklanmoqda...
      </main>
    );
  }

  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDay = (new Date(year, monthIndex, 1).getDay() + 6) % 7;

  const monthName = month.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' });

  function dateString(day) {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function eventsForDate(date) {
    return events.filter(
      (event) => event.start_date <= date && (!event.end_date || event.end_date >= date),
    );
  }

  const selectedEvents = selectedDate ? eventsForDate(selectedDate) : [];

  async function addEvent(e) {
    e.preventDefault();
    setMessage('');

    if (!title.trim() || !startDate) {
      setMessage('Tadbir nomi va boshlanish sanasini kiriting.');
      return;
    }

    if (endDate && endDate < startDate) {
      setMessage('Tugash sanasi boshlanish sanasidan oldin bo‘lishi mumkin emas.');
      return;
    }

    try {
      await api.post('/events', {
        title: title.trim(),
        description: description.trim() || undefined,
        eventType,
        startDate,
        endDate: endDate || undefined,
        location: location.trim() || undefined,
      });
    } catch (error) {
      setMessage('Tadbir qo‘shilmadi: ' + error.message);
      return;
    }

    setTitle('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setLocation('');
    setShowForm(false);
    setMessage('Tadbir muvaffaqiyatli qo‘shildi!');

    await loadEvents();
  }

  function changeMonth(direction) {
    setMonth(new Date(year, monthIndex + direction, 1));
    setSelectedDate('');
  }

  return (
    <main className="min-h-screen bg-[#f7f8f3] px-5 py-10 text-[#24352b]">
      <div className="mx-auto max-w-5xl">
        <a href="/" className="text-sm font-medium text-green-800">
          ← Bosh sahifa
        </a>

        <header className="mb-9 mt-7">
          <p className="text-sm font-semibold uppercase tracking-widest text-green-700">
            ECO SCHOOL · CALENDAR
          </p>

          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Eco Calendar</h1>

          <p className="mt-4 max-w-2xl leading-7 text-[#66746a]">
            Ekologik tadbirlar, challenge‘lar va muhim sanalarni kuzatib boring.
            Har bir sana — yangi imkoniyat.
          </p>
        </header>

        <div className="mb-6 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-blue-100 px-3 py-2 text-blue-800">● Tadbir</span>
          <span className="rounded-full bg-green-100 px-3 py-2 text-green-800">● Challenge</span>
          <span className="rounded-full bg-amber-100 px-3 py-2 text-amber-800">
            ● Ekologik kun
          </span>
        </div>

        {message && (
          <div className="mb-5 rounded-xl bg-green-50 p-4 text-sm text-green-900">
            {message}
          </div>
        )}

        {isAdmin && (
          <div className="mb-6">
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-xl bg-green-800 px-5 py-3 font-semibold text-white"
            >
              + Yangi tadbir qo‘shish
            </button>

            {showForm && (
              <form
                onSubmit={addEvent}
                className="mt-4 grid gap-4 rounded-2xl border border-[#e3e9df] bg-white p-6"
              >
                <h2 className="text-xl font-bold">Yangi ekologik tadbir</h2>

                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Tadbir nomi"
                  className="rounded-xl border p-3"
                />

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tadbir haqida ma’lumot"
                  className="rounded-xl border p-3"
                  rows={3}
                />

                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="rounded-xl border p-3"
                >
                  <option value="event">Tadbir</option>
                  <option value="challenge">Challenge</option>
                  <option value="eco_day">Ekologik kun</option>
                </select>

                <label className="text-sm font-medium">
                  Boshlanish sanasi
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 block w-full rounded-xl border p-3"
                  />
                </label>

                <label className="text-sm font-medium">
                  Tugash sanasi (ixtiyoriy)
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 block w-full rounded-xl border p-3"
                  />
                </label>

                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Joylashuv (ixtiyoriy)"
                  className="rounded-xl border p-3"
                />

                <button
                  type="submit"
                  className="rounded-xl bg-green-800 px-5 py-3 font-semibold text-white"
                >
                  Tadbirni saqlash
                </button>
              </form>
            )}
          </div>
        )}

        <section className="rounded-2xl border border-[#e3e9df] bg-white p-5 sm:p-7">
          <div className="mb-6 flex items-center justify-between gap-3">
            <button
              onClick={() => changeMonth(-1)}
              className="rounded-lg border px-4 py-2"
              aria-label="Oldingi oy"
            >
              ←
            </button>

            <h2 className="text-xl font-bold capitalize">{monthName}</h2>

            <button
              onClick={() => changeMonth(1)}
              className="rounded-lg border px-4 py-2"
              aria-label="Keyingi oy"
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 sm:gap-2 sm:text-sm">
            {['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>

          {loading ? (
            <p className="py-10 text-center text-gray-500">Calendar yuklanmoqda...</p>
          ) : (
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {Array.from({ length: firstDay }).map((_, index) => (
                <div key={`empty-${index}`} />
              ))}

              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const date = dateString(day);
                const dayEvents = eventsForDate(date);
                const isSelected = selectedDate === date;

                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`min-h-16 rounded-xl border p-1 text-left transition sm:min-h-24 sm:p-2 ${
                      isSelected
                        ? 'border-green-700 bg-green-50'
                        : 'border-[#edf0e9] hover:bg-[#f7f8f3]'
                    }`}
                  >
                    <span className="text-sm font-semibold">{day}</span>

                    <div className="mt-1 flex flex-wrap gap-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <span
                          key={event.id}
                          className={`h-2 w-2 rounded-full ${
                            event.event_type === 'challenge'
                              ? 'bg-green-600'
                              : event.event_type === 'eco_day'
                                ? 'bg-amber-500'
                                : 'bg-blue-500'
                          }`}
                        />
                      ))}
                    </div>

                    {dayEvents.length > 0 && (
                      <p className="mt-1 hidden truncate text-xs text-gray-500 sm:block">
                        {dayEvents.length} ta tadbir
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selectedDate && (
          <section className="mt-6 rounded-2xl border border-[#e3e9df] bg-white p-6">
            <h2 className="mb-4 text-xl font-bold">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('uz-UZ', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </h2>

            {selectedEvents.length === 0 ? (
              <p className="text-gray-500">Bu sana uchun hozircha tadbir belgilanmagan.</p>
            ) : (
              <div className="space-y-4">
                {selectedEvents.map((event) => (
                  <article key={event.id} className="rounded-xl bg-[#f7f8f3] p-4">
                    <div className="mb-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          typeColors[event.event_type]
                        }`}
                      >
                        {typeLabels[event.event_type]}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold">{event.title}</h3>

                    {event.description && (
                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        {event.description}
                      </p>
                    )}

                    {event.location && (
                      <p className="mt-2 text-sm text-gray-500">📍 {event.location}</p>
                    )}

                    {event.end_date && event.end_date !== event.start_date && (
                      <p className="mt-2 text-xs text-gray-500">
                        Tugash sanasi: {event.end_date}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <p className="mt-6 text-xs leading-5 text-gray-500">
          Eslatma: Calendar‘dagi tadbirlar maktab yoki ECO SCHOOL administratorlari
          tomonidan kiritiladi.
        </p>
      </div>
    </main>
  );
}
