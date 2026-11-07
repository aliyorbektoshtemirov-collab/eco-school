#!/usr/bin/env python3
"""
`flutter create` yasagan Android manifestini to'g'rilaydi.

Ikki narsa:

1. Internetga ruxsat. Flutter uni faqat debug va profile manifestiga
   qo'yadi — release APK'da bo'lmaydi va ilova serverga chiqa olmaydi.
   Shuning uchun uni asosiy manifestga o'zimiz qo'shamiz.

2. Ilova nomi: "ecoschool" o'rniga "ECO SCHOOL".
"""

import pathlib
import re
import sys

PERMISSION = '    <uses-permission android:name="android.permission.INTERNET" />\n'


def main() -> int:
    path = pathlib.Path("android/app/src/main/AndroidManifest.xml")
    if not path.exists():
        print("AndroidManifest.xml topilmadi.", file=sys.stderr)
        return 1

    text = path.read_text(encoding="utf-8")

    if "android.permission.INTERNET" not in text:
        text = text.replace("<application", PERMISSION + "\n    <application", 1)
        print("Internetga ruxsat qo'shildi")
    else:
        print("Internetga ruxsat allaqachon bor")

    text = re.sub(r'android:label="[^"]*"', 'android:label="ECO SCHOOL"', text, count=1)

    path.write_text(text, encoding="utf-8")

    for line in text.splitlines():
        if "uses-permission" in line or "android:label" in line:
            print("  ", line.strip())

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
