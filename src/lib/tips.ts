export const ECO_TIPS = [
  { title: 'O‘z idishingizni olib yuring', text: 'Bugun ichimlik uchun qayta ishlatiladigan idish tanlang. Bir martalik plastikni kamaytirish shundan boshlanadi.', action: 'Recyclingni ko‘rish', path: '/recycling' },
  { title: 'Qog‘ozning ikki tomonidan foydalaning', text: 'Qoralama uchun bo‘sh tomonini ishlating. Toza, quruq qog‘ozni qayta ishlash uchun alohida yig‘ing.', action: 'Qog‘oz topshirish', path: '/recycling' },
  { title: 'Bugungi kichik g‘alabangizni tanlang', text: 'Ochiq vazifalardan bittasini tanlang. Bajargan ishingizni izoh yoki rasm bilan yuborib, natijani kuzating.', action: 'Vazifa tanlash', path: '/challenges' },
  { title: 'Birga qilish osonroq', text: 'Sinfdoshingiz bilan bitta eko odatni bir hafta davom ettiring. Marafonlar bo‘limida yangi imkoniyatlarni tekshiring.', action: 'Marafonlarni ko‘rish', path: '/marafon' },
  { title: 'Suvni behuda oqizmang', text: 'Qo‘lni sovunlayotganda jo‘mrakni yoping. Nosoz jo‘mrakni ko‘rsangiz, maktab mas’uliga ayting.', action: 'Natijalarni ko‘rish', path: '/impact' },
  { title: 'Chiqindini to‘g‘ri saralang', text: 'Qog‘oz va plastikni alohida, toza va quruq holda yig‘ing. Topshirishdan oldin maktabdagi qabul qoidalarini tekshiring.', action: 'Recyclingni ochish', path: '/recycling' },
  { title: 'G‘oyangizni tadqiqotga aylantiring', text: 'Maktabda ko‘rgan bitta ekologik muammoni yozib qo‘ying. Uni kichik loyiha orqali qanday yaxshilash mumkinligini o‘ylang.', action: 'Eco Research', path: '/research' },
];
export function dailyTip(now = new Date()) {
  const day = Math.floor((now.getTime() + 5 * 3600000) / 86400000);
  return { id: day, ...ECO_TIPS[day % ECO_TIPS.length] };
}
