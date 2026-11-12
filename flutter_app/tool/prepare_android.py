#!/usr/bin/env python3
"""
`flutter create` yasagan Android manifestini to'g'rilaydi.

Ikki narsa:

1. Internetga ruxsat. Flutter uni faqat debug va profile manifestiga
   qo'yadi — release APK'da bo'lmaydi va ilova serverga chiqa olmaydi.
   Shuning uchun uni asosiy manifestga o'zimiz qo'shamiz.

2. Ilova nomi: "ecoschool" o'rniga "ECO SCHOOL".

3. Lint tekshiruvini o'chirish. Release yig'ishda Android lint ba'zan
   o'zi qulab (Java xatosi) butun build'ni to'xtatadi. Ilova kodiga
   aloqasi yo'q — tekshiruv faqat maslahat beradi, shuning uchun o'chiramiz.
"""

import pathlib
import re
import sys

PERMISSION = '    <uses-permission android:name="android.permission.INTERNET" />\n'


def disable_lint() -> None:
    kts = pathlib.Path("android/app/build.gradle.kts")
    groovy = pathlib.Path("android/app/build.gradle")

    if kts.exists():
        text = kts.read_text(encoding="utf-8")
        if "checkReleaseBuilds" not in text:
            block = (
                "android {\n"
                "    lint {\n"
                "        checkReleaseBuilds = false\n"
                "        abortOnError = false\n"
                "    }\n"
            )
            text = text.replace("android {\n", block, 1)
            kts.write_text(text, encoding="utf-8")
        print("Lint o'chirildi (kts)")
    elif groovy.exists():
        text = groovy.read_text(encoding="utf-8")
        if "checkReleaseBuilds" not in text:
            block = (
                "android {\n"
                "    lint {\n"
                "        checkReleaseBuilds false\n"
                "        abortOnError false\n"
                "    }\n"
            )
            text = text.replace("android {\n", block, 1)
            groovy.write_text(text, encoding="utf-8")
        print("Lint o'chirildi (groovy)")
    else:
        print("build.gradle topilmadi — lint o'chirilmadi", file=sys.stderr)


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
    disable_lint()

    for line in text.splitlines():
        if "uses-permission" in line or "android:label" in line:
            print("  ", line.strip())

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
