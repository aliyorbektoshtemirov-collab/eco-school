# 🌱 ECO SCHOOL

Asl sayt (Next.js + Supabase) **React + Tailwind + Cloudflare** ga ko‘chirildi.
Dizayn, matnlar va sahifalar o‘zgarmadi.

| Qism | Edi | Bo‘ldi |
|---|---|---|
| Frontend | Next.js 16 (App Router) | React 18 + Vite + React Router |
| Uslublar | Tailwind CSS 4 | Tailwind CSS 4 (o‘zgarmadi) |
| Baza | Supabase Postgres | **Cloudflare D1** |
| Rasmlar | Supabase Storage | **Cloudflare R2** |
| Server | Render | **Cloudflare Workers** |
| Kirish | email + parol | **login + parol** |

### Sahifalar

`/` · `/challenges` · `/recycling` · `/recycling-admin` · `/impact` ·
`/leaderboard` · `/class-leaderboard` · `/research` · `/calendar` ·
`/login` · `/profile` · `/admin` · `/setup`

---

## ⚠️ Bitta o‘zgarish: email o‘rniga login

Asl saytda ro‘yxatdan o‘tishda **email** so‘ralardi. Siz aytganingizdek,
kichik sinf o‘quvchilarida email yo‘q — shuning uchun o‘sha bitta maydon
**Login** ga almashtirildi. Formaning qolgan hammasi (ism, maktab kodi,
“Sinflarni yuklash” tugmasi, sinf tanlash, parol) va ko‘rinishi aynan o‘sha.

Agar emailni qaytarish kerak bo‘lsa — ayting, bir maydon almashtiriladi.

---

## 🚀 Ishga tushirish

### 1. Kutubxonalar

```bash
npm run setup
```

### 2. Cloudflare

```bash
npx wrangler login
```

### 3. D1 bazasi

```bash
npm run db:create
```

Chiqqan `database_id` ni **`wrangler.toml`** ichiga qo‘ying, so‘ng:

```bash
npm run db:remote
```

### 4. R2 (dalil rasmlari)

```bash
npm run r2:create
```

> Xato bersa: Cloudflare panelida **R2 Object Storage → Get started** ni bir
> marta bosing (bepul 10 GB). R2 kerak bo‘lmasa, `wrangler.toml` dagi
> `[[r2_buckets]]` bo‘limini izohga oling — sayt rasmsiz ishlayveradi.

### 5. Maxfiy kalitlar

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put SETUP_KEY
```

- `SESSION_SECRET` — uzun tasodifiy matn (`openssl rand -hex 32`)
- `SETUP_KEY` — birinchi owner hisobini yaratish uchun bir martalik parol

### 6. Chiqarish

```bash
npm run deploy
```

### 7. Owner hisobi

Brauzerda **`/setup`** sahifasini oching, `SETUP_KEY` ni kiriting va owner
login-parolini belgilang. Sahifa shundan keyin o‘zi yopiladi.

---

## 🤖 Telegram bot (ixtiyoriy)

Bot ikki ish qiladi: **har dushanba** bajarilmagan vazifalarni eslatadi va
topshiriq tasdiqlanganda darhol xabar beradi. Bundan tashqari o'quvchi
**botning o'zidan ro'yxatdan o'ta oladi** — saytga kirish ham, email ham
kerak emas.

Bot sozlanmasa sayt o'zgarishsiz ishlayveradi.

### Sozlash

**1.** Telegramda [@BotFather](https://t.me/BotFather) ga `/newbot` yozing —
u **token** beradi.

**2.** Tokenni Cloudflare'ga qo'ying (fayllarga yozmang):

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET   # o'zingiz o'ylagan uzun matn
```

**3.** `wrangler.toml` dagi `[vars]` ichida izohni oching:

```toml
TELEGRAM_BOT_USERNAME = "eco_school_bot"
SITE_URL = "https://eco-school.<subdomain>.workers.dev"
```

**4.** `npm run deploy`. **Tamom.**

Webhook o'zi ulanadi: deploy'dan keyin saytga birinchi kirgan odamning
so'rovi buni ishga tushiradi. Agar webhook biror sababga ko'ra buzilsa,
olti soatda bir marta tekshirilib, o'zi tiklanadi. Qo'lda ulash kerak
bo'lsa, owner `POST /api/telegram/setup` ni chaqirishi mumkin
(`/api/telegram/info` — holat, `/api/telegram/teardown` — o'chirish).

### BotFather'da buyruqlar ro'yxati

`/setcommands` ga shuni qo'ying:

```
royxat - Ro'yxatdan o'tish
kirish - Hisobim bor, ulash
marafon - Marafon holati
ball - Ballarim va o'rnim
challenge - Bajarilmagan vazifalar
stop - Hisobdan chiqish
```

### 📱 Mini App — sayt botning ichida

Bot ichida yozishma ostida **ECO SCHOOL** tugmasi turadi. Bosilsa, sayt
Telegramdan chiqmasdan o'sha yerda ochiladi: challenge topshirish, rasm
yuklash, reyting — hammasi ishlaydi.

**Login so'ralmaydi.** Telegram ilovaga imzolangan ma'lumot (`initData`)
beradi, Worker uni bot tokeni bilan tekshiradi va o'sha Telegram hisobiga
bog'langan profilga sessiya ochadi. Imzoni faqat Telegram yarata oladi,
shuning uchun bu parol so'rashdan kam emas. 24 soatdan eski imzo qabul
qilinmaydi.

Tugma webhook bilan birga avtomatik qo'yiladi — qo'lda sozlash shart emas.
Shart: `SITE_URL` **https** bo'lishi kerak (Telegram http manzilni
qabul qilmaydi).

Hisobi ulanmagan odam ilovani ochsa, oddiy kirish sahifasini ko'radi va
botga qaytib ro'yxatdan o'tadi.

> Ilova Telegram Web'da `iframe` ichida ochilgani uchun `X-Frame-Options`
> o'rniga CSP `frame-ancestors` ishlatiladi: faqat `telegram.org` va uning
> subdomenlari ruxsat etilgan, boshqa hech kim saytni o'z sahifasiga
> joylab ololmaydi.

### O'quvchi tomoni

`/start` bosganda ikkita tugma chiqadi:

- **Ro'yxatdan o'tish** — ism → sinf (tugmalar ro'yxatidan) → login → parol.
  Hisob shu yerda yaratiladi va darhol Telegramga ulanadi. O'sha login-parol
  bilan saytga ham kiradi.
- **Hisobim bor** — login va parol yozib ulaydi.

Uchinchi yo'l ham qoldi: saytdagi **Profilim → Telegramni ulash** 6 xonali
kod beradi, uni botga yuborish kifoya.

**Chiqish.** `/start` dagi «🚪 Hisobdan chiqish» tugmasi yoki `/stop`.
Tasdiq so'raladi. Hisob o'chmaydi — faqat Telegramdan uziladi, saytdagi
login va parol o'zgarishsiz qoladi.

**Vazifalar botda.** `/challenge` bajarilmagan vazifalarni alohida-alohida
xabar qilib yuboradi; har birining ichida «✅ Bajarish» tugmasi bo'ladi va
u Mini App'ni o'sha vazifaning topshirish oynasida ochadi. Beshtadan ko'pi
bo'lsa, qolganlari uchun «Hammasini ko'rish» tugmasi chiqadi.

> **Parol haqida.** Parol Telegram yozishmasida qolmasligi uchun bot
> parol yozilgan xabarni **darhol o'chiradi**. Bazada, saytdagidek, faqat
> PBKDF2 hash saqlanadi — parolning o'zi hech qayerda yozilmaydi.
> Noto'g'ri parol 5 marta kiritilsa, suhbat to'xtatiladi.

> Telegram javob bermasa (tarmoq uzilgan, bot o'chirilgan) ball berish va
> tasdiqlash **buzilmaydi** — xato faqat log'ga yoziladi.

---

## 🛠 Admin panel

`/admin` — adminlar uchun bitta ish oynasi. Yuqoridagi raqamlar ayni paytda
nima kutayotganini ko'rsatadi va ayni vaqtda bo'lim almashtirgich:

| Bo'lim | Nima qilinadi |
|---|---|
| **Topshiriq** | Challenge hisobotlari: izoh va rasmni ko'rib, tasdiqlash yoki rad etish |
| **Recycling** | Tarozidagi haqiqiy vaznni kiritib tasdiqlash — ball o'sha raqamdan hisoblanadi |
| **Tadqiqot** | Tadqiqotlar o'z sahifasida (`/research`) baholanadi, 0–40 ball |
| **Vazifalar** | Challenge qo'shish, tahrirlash, o'chirish |
| **Marafon** | Ko'p kunlik challenge yaratish va yakunlash |
| **E'lon** | Hamma o'quvchiga xabar: saytda banner + botga xabar |
| **O'quvchi** | Foydalanuvchilar ro'yxati, qidiruv, rol va parol |

Har bir amal ikki bosqichli: tugmani bosganda yonida «Aniqmi? Ha / Yo'q»
chiqadi. Tasodifan tasdiqlab yuborilmaydi.

Telefonda panelga kirish uchun: **Profilim → Admin panel**.

### Vazifa qo'shish

«Vazifalar» bo'limida **Yangi vazifa**: sarlavha, tavsif, turkum, ball va
(ixtiyoriy) tugash sanasi. Saqlangach vazifa saytdagi Challenges sahifasida
darhol paydo bo'ladi va **botga ulangan har bir o'quvchiga alohida xabar**
ketadi — ichida «✅ Bajarish» tugmasi bilan.

Topshiriq kelgan vazifani o'chirib bo'lmaydi (berilgan ballar yo'qolmasin),
lekin tahrirlash mumkin.

### Rollar va admin tayinlash

Owner bitta bo'ladi va adminlarni o'zi tayinlaydi. Admin arizalarni ko'rib
chiqadi va vazifa qo'sha oladi, lekin rol o'zgartira olmaydi — shunda
tarkib tasodifan o'zgarib ketmaydi.

Admin tayinlashning ikki yo'li bor, ikkalasi ham «O'quvchi» bo'limida:

1. **Ro'yxatdan** — allaqachon ro'yxatdan o'tgan odam qatorida «Admin qilish».
2. **Noldan** — hisobi yo'q o'qituvchi uchun «Admin qo'shish»: ism, login va
   (xohlasangiz) parol. Parolni bo'sh qoldirsangiz tizim o'zi yaratadi va
   bir marta ekranda ko'rsatadi.

**Parolni tiklash.** Owner ro'yxatdan «Parolni tiklash» ni bossa,
vaqtinchalik parol bir marta ko'rsatiladi va o'sha hisobning barcha
sessiyalari bekor qilinadi.

Owner parolini unutsa, terminaldan tiklanadi:

```bash
node tools/reset-password.mjs
```

---

## 🏁 Marafon — ko'p kunlik challenge

Oddiy challenge bir marta bajariladi. Marafon esa kun sayin davom etadi:
30 kun (yoki nechchi xohlasangiz), har kunning o'z vazifasi, har kuni ball.

**Qanday ishlaydi.** Admin panelning «Marafon» bo'limida yaratasiz:
sarlavha, tavsif, necha kun, kunlik ball, hammasini bajarganga bonus,
boshlanish sanasi va kunlik vazifalar — har qatorda bittadan:

```
Bitta plastik paketdan voz keching
Jo'mrakni yopib tish yuving
Keraksiz chiroqlarni o'chiring
...
```

Qator soni kunlar sonidan kam bo'lsa, qolgan kunlarda umumiy tavsif
ko'rsatiladi.

E'lon qilingach:

1. Botga ulangan har bir o'quvchiga **«🏃 Qo'shilaman»** tugmasi bilan xabar ketadi.
2. Qo'shilganlarga **har kuni soat 16:00 da** o'sha kunning vazifasi yuboriladi,
   ichida **«✅ Bajardim»** tugmasi bilan. Allaqachon belgilagan odamga
   eslatma bormaydi.
3. Tugma bosilganda ball darhol qo'shiladi va ketma-ket necha kun
   bajarilgani («streak») aytiladi.
4. Oxirgi kun o'tgach marafon o'zi yakunlanadi va har bir ishtirokchiga
   natijasi yuboriladi.

Saytda bu `/marafon` sahifasi: kunlar panjarasi (bajarilgan / o'tkazib
yuborilgan / hali kelmagan), bugungi vazifa va «Bajardim» tugmasi.

**Nega tasdiqlash yo'q.** 30 kun × yuzlab o'quvchi — hech bir Eco Team buni
ko'rib chiqa olmaydi, navbat bir kunda tiqilib qolardi. Shuning uchun kunlik
belgilash o'quvchining o'ziga ishonadi, admin esa panelda kim nechta kun
bajarganini ko'rib turadi. Faqat bugungi yoki kechagi kunni belgilash
mumkin — oxirida hammasini birdan to'ldirib qo'yib bo'lmaydi.

Bot buyrug'i: `/marafon`.

---

## 📣 E'lonlar

Owner `/admin` → **E'lon** bo'limida yozadi. Ikkita katakcha bor:

- **Botga ham yuborilsin** — ulangan har bir kishiga xabar ketadi
- **Saytda banner bo'lib tursin** — sahifa tepasida yashil chiziq

O'quvchi bannerni yopsa, qayta ko'rinmaydi — yangi e'lon chiqqunicha.
Yopilgani brauzerda saqlanadi, shuning uchun server tomonda hech narsa
hisoblanmaydi.

E'lon yozish faqat owner qo'lida: hamma o'quvchiga birdan ketadigan xabar
tasodifan yuborilmasligi kerak. Adminlar ro'yxatni ko'radi.

---

## 📊 Reyting davrlari

Reytingda uchta ko'rinish bor: **Shu hafta · Shu oy · Umumiy**. Sinflar
bellashuvida ham shunday.

Umumiy reyting `profiles.points` dan olinadi. Davriy reyting esa ball
manbalaridan qaytadan hisoblanadi — topshiriq, recycling, tadqiqot va
marafon belgilashlari. Sana sifatida ish bajarilgan payt olinadi
(tasdiqlangan payt emas): o'quvchi uchun «men buni o'tgan hafta qilganman»
degani tushunarliroq.

Shuning uchun har hafta reyting noldan boshlanadi — kech qo'shilgan bola
ham birinchi o'rinni olishi mumkin.

---

## 📢 Kanal

Bot shaxsiy xabar yuboradi — faqat hisobini ulagan bolalarga. Kanal esa
hammaga ko'rinadi: ulanmagan o'quvchilar ham, ota-onalar ham, maktab
ma'muriyati ham kuzatib turadi.

Kanalga avtomatik joylanadi:

- yangi challenge
- yangi marafon e'loni (**«🏃 Qo'shilish»** tugmasi bilan)
- **marafonning har kungi vazifasi** — kuniga bitta post
- marafon yakuni
- adminlardan e'lonlar

Shaxsiy xabarlar avvalgidek ketaveradi — kanal ularning o'rniga emas,
ustiga qo'shiladi.

### Sozlash

1. Telegramda kanal oching (ochiq bo'lsa `@nomi` bo'ladi).
2. Botingizni kanalga **admin** qiling — «Post messages» huquqi kerak.
3. `wrangler.toml` da izohni oching:

```toml
TELEGRAM_CHANNEL = "@eco_school_andijon"
```

Yopiq kanal bo'lsa `@nomi` o'rniga `-100...` bilan boshlanadigan raqamini
yozasiz.

4. `npm run deploy`, so'ng owner bo'lib kirib Console'da tekshiring:

```js
fetch('/api/telegram/channel-test', { method: 'POST', headers: { 'X-Eco-Client': 'web' } })
  .then(r => r.json()).then(console.log)
```

Kanalga sinov xabari tushsa — tayyor. Tushmasa, javobdagi xato nima
gapligini aytadi (odatda bot admin qilinmagan yoki nom xato yozilgan).

> Kanal postlarida Mini App tugmasi bo'lmaydi — Telegram kanal
> postlarida bunga ruxsat bermaydi. O'rniga botni ochadigan oddiy havola
> tugmasi qo'yiladi, bola botga kirib belgilaydi.

> Bir post ikki marta chiqmaydi: nima joylangani bazada belgilanadi,
> shuning uchun cron qayta ishga tushsa ham kanal takrorlanmaydi.

---

## 🏫 Maktab kodi va sinflar

Boshlang‘ich ma’lumotlarda bitta maktab bor:

| Maktab kodi | `ANDIJON01` |
|---|---|
| Nomi | Eco Future Andijan |
| Sinflar | 5-A, 5-B, 6-A, 6-B, 7-A, 7-B, 7-D, 8-A, 8-B, 8-D, 9-A, 9-A IDUM, 9-B, 9-D, 10-A, 10-A IDUM, 10-B, 10-D, 11-A, 11-A IDUM, 11-B, 11-D |

O‘quvchilar ro‘yxatdan o‘tishda shu kodni kiritadi. Kodni yoki sinflarni
o‘zgartirish uchun `migrations/0002_seed.sql` faylini tahrirlang
(yoki bazaga to‘g‘ridan-to‘g‘ri SQL yozing).

---

## ⭐ Ballar

| Faoliyat | Ball |
|---|---|
| Recycling | **1 kg = 25 ball** (Eco Team tasdiqlagan haqiqiy vazn bo‘yicha) |
| Challenge | Har bir challenge‘ning o‘z balli (20–80) |
| Research | Admin qo‘yadi, 0–40 |

`POINTS_PER_KG` ni `wrangler.toml` dan o‘zgartirish mumkin.

---

## 🔒 Xavfsizlik

- Parollar PBKDF2-SHA256, 100 000 iteratsiya, har biriga alohida salt
- Sessiya tokeni HMAC bilan imzolanadi, bazada faqat SHA-256 hash saqlanadi
- Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`
- CSRF himoyasi: Origin tekshiruvi + maxsus sarlavha
- Login uchun 15 daqiqada 8 urinish (IP bo‘yicha alohida)
- Barcha SQL so‘rovlar parametrli
- Yuklangan fayl **ichki baytlari** bo‘yicha tekshiriladi — nomi `.jpg` qilib
  o‘zgartirilgan boshqa fayl o‘tmaydi
- Dalil rasmlarini faqat egasi va adminlar ko‘ra oladi
- CSP, HSTS, `X-Frame-Options`, `nosniff`

---

## 💻 Kompyuterda ishlash

```bash
cp .dev.vars.example .dev.vars   # kalitlarni to'ldiring
npm run db:local
npm run dev                      # http://localhost:8787
```

Dizayn ustida ishlaganda ikki terminal:

```bash
npx wrangler dev        # API (8787)
npm run dev:web         # sayt (5173)
```

---

## 📁 Tuzilishi

```
eco-school/
├── wrangler.toml          # Cloudflare sozlamalari
├── migrations/            # D1 jadvallari
├── src/                   # Worker (API)
│   ├── index.ts
│   ├── lib/               # auth, crypto, ratelimit, validate, images
│   └── routes/            # auth, stats, challenges, recycling, research, events, uploads
└── web/                   # React sayt
    ├── public/timo.png
    └── src/
        ├── pages/         # 13 ta sahifa
        └── lib/           # api, auth
```

---

## ⚙️ GitHub Actions bilan chiqarish

Repoda `.github/workflows/deploy.yml` bor: `main` ga push qilinganda sayt
o'zi chiqadi. Faqat ikkita secret kerak — GitHub'da
**Settings → Secrets and variables → Actions → New repository secret**:

| Nomi | Qayerdan olinadi |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create Token → **Edit Cloudflare Workers** shabloni |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare bosh sahifasining o'ng tomonida, yoki `npx wrangler whoami` |

Maxfiy kalitlar (`SESSION_SECRET`, `SETUP_KEY`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_WEBHOOK_SECRET`) GitHub'ga **qo'yilmaydi** — ular Cloudflare'ning
o'zida `wrangler secret put` bilan bir marta saqlanadi va deploy'da
o'zgarmaydi.

**Migratsiyalar.** Oddiy push'da baza tegilmaydi. Yangi migratsiya qo'shsangiz,
GitHub'da **Actions → Deploy → Run workflow** ni ochib, «Bazaga yangi
migratsiyalarni ham qo'llash» katagini belgilaysiz. Shunda `db:remote` ham
ishlaydi. Buni ataylab qo'lda qoldirdim — baza o'zgarishi tasodifan
ketmasin.

---

## 📱 Android ilova (Flutter)

`flutter_app/` — Dart'da yozilgan haqiqiy Android ilovasi. Sayt bilan
bitta API'dan ishlaydi, dizayni ham saytnikidek.

**Ichida nima bor.** Pastki beshta bo'lim: Vazifalar, Marafon, Recycling,
Reyting, Profil. Adminlar uchun profil ichida «Admin panel» — tasdiqlash
navbati, vazifa va marafon yaratish, e'lon yuborish.

Rasm kamera yoki galereyadan olinadi, telefonning o'zida kichraytiriladi
va serverga yuboriladi.

**Kirish.** Ilova cookie emas, token ishlatadi: kirishda server token
qaytaradi, u telefonda saqlanadi va keyingi so'rovlarda sarlavhada
ketadi. Shuning uchun bola bir marta kirsa, ilova uni eslab qoladi.

### Yig'ish

GitHub'da **Actions → Android APK → Run workflow**. Uch maydon: sayt
manzili, versiya nomi, versiya raqami. APK `Artifacts → eco-school-apk`
dan yuklab olinadi.

Android papkasi repoda saqlanmaydi — uni `flutter create` har safar
yangidan yasaydi, `lib/` va `pubspec.yaml` esa bizniki qolaveradi. Shuning
uchun repo yengil va Flutter versiyasi yangilansa ham muammo bo'lmaydi.

### O'z kalitingiz bilan imzolash

Kalitsiz ham yig'iladi (sinov kaliti bilan), lekin bunday APK'ni keyin
yangilab bo'lmaydi — har safar eskisini o'chirib, qaytadan o'rnatishga
to'g'ri keladi.

```bash
keytool -genkeypair -v -keystore eco.jks -alias eco -keyalg RSA -keysize 2048 -validity 10000
certutil -encode eco.jks eco.txt
```

`eco.txt` ichidagi matnni (BEGIN/END qatorlarisiz) GitHub secret'iga
qo'yasiz:

| Nomi | Qiymati |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | o'sha matn |
| `ANDROID_KEYSTORE_PASSWORD` | kalit paroli |
| `ANDROID_KEY_ALIAS` | `eco` |
| `ANDROID_KEY_PASSWORD` | kalit paroli |

`eco.jks` faylini yo'qotmang — ilovani yangilash faqat shu kalit bilan
mumkin.

### Kompyuterda ishlatish

```bash
cd flutter_app
flutter create --platforms=android --org uz --project-name ecoschool .
flutter pub get
flutter run --dart-define=ECO_API=https://eco-school.eco-school.workers.dev
```

---

## 🔄 Yangilanish

```bash
npm run setup
npm run db:remote     # yangi jadvallar uchun — o'tkazib yubormang
npm run deploy
```
