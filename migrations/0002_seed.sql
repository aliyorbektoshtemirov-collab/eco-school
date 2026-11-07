-- Boshlang'ich ma'lumotlar: bitta maktab, uning sinflari va challenge'lar.
-- Maktab kodi ro'yxatdan o'tishda ishlatiladi.

INSERT OR IGNORE INTO schools (id, code, name) VALUES
  (1, 'ANDIJON01', 'Eco Future Andijan');

INSERT OR IGNORE INTO school_classes (school_id, class_name) VALUES
  (1, '5-A'), (1, '5-B'),
  (1, '6-A'), (1, '6-B'),
  (1, '7-A'), (1, '7-B'), (1, '7-D'),
  (1, '8-A'), (1, '8-B'), (1, '8-D'),
  (1, '9-A'), (1, '9-B'), (1, '9-D'),
  (1, '10-A'), (1, '10-B'), (1, '10-D'),
  (1, '11-A'), (1, '11-B'), (1, '11-D');

INSERT OR IGNORE INTO challenges (id, title, description, category, points, school_id) VALUES
  (1, 'Plastiksiz bir hafta',
      'Bir martalik plastikdan foydalanishni kamaytiring. Bir hafta davomida plastik paket, idish va naychadan voz keching, o''rniga mato sumka va qayta ishlatiladigan idish ishlating.',
      'CHIQINDILAR', 50, 1),
  (2, 'Qog''ozni asraymiz',
      'Qog''ozni tejang va qayta ishlashga topshiring. Daftar va qog''ozning ikkala tomonidan foydalaning, sinfda qog''oz yig''ish qutisini tashkil qiling.',
      'RESURSLAR', 30, 1),
  (3, 'Chiroqni o''chir!',
      'Keraksiz chiroqlarni o''chirib, energiyani tejang. Sinfdan chiqayotganda chiroq va proyektorni o''chiring, zaryadlagichlarni rozetkadan uzing.',
      'ENERGIYA', 20, 1),
  (4, 'Suvni tejaymiz',
      'Kuniga 10 litr suvni tejashga harakat qiling. Tish yuvayotganda jo''mrakni yoping, oqayotgan jo''mraklarni aniqlab, ma''muriyatga xabar bering.',
      'SUV', 30, 1),
  (5, 'Daraxt ekamiz',
      'Maktab hovlisida yoki uyingiz yonida ko''chat eking va unga qarashni o''z zimmangizga oling.',
      'TABIAT', 80, 1);

INSERT OR IGNORE INTO eco_events (title, description, event_type, start_date, location, school_id) VALUES
  ('Maktab hashari', 'Maktab hovlisini tozalash va ko''kalamzorlashtirish.', 'event', '2026-11-21', 'Maktab hovlisi', 1),
  ('Qog''oz yig''ish haftaligi', 'Sinflar o''rtasida qog''oz to''plash bo''yicha musobaqa.', 'challenge', '2026-12-01', NULL, 1),
  ('Jahon suv kuni', 'Suv resurslarini asrashga bag''ishlangan xalqaro kun.', 'eco_day', '2027-03-22', NULL, 1),
  ('Yer kuni', 'Sayyoramizni asrash uchun global harakat kuni.', 'eco_day', '2027-04-22', NULL, 1);
