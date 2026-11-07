#!/usr/bin/env python3
"""
Yig'ilish paytida imzo sozlamasini qo'shadi.

Android papkasi repoda saqlanmaydi — uni `flutter create` har safar
yangidan yaratadi. Shuning uchun imzo sozlamasi ham har safar shu skript
bilan qo'shiladi. Kalit berilmasa, hech narsa o'zgartirilmaydi va APK
sinov (debug) kaliti bilan imzolanadi.

Ishlatilishi:
    python3 tool/configure_signing.py <keystore-fayl> <parol> <alias> <kalit-paroli>
"""

import pathlib
import sys

KTS_SIGNING = '''android {
    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
        }
    }'''

KTS_HEADER = '''import java.util.Properties
import java.io.FileInputStream

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

'''

GROOVY_SIGNING = '''android {
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }'''

GROOVY_HEADER = '''def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

'''


def main() -> int:
    if len(sys.argv) < 5:
        print("Kalit berilmadi — sinov (debug) kaliti ishlatiladi.")
        return 0

    store, store_password, alias, key_password = sys.argv[1:5]

    android = pathlib.Path("android")
    if not android.is_dir():
        print("android/ papkasi topilmadi.", file=sys.stderr)
        return 1

    # Gradle shu fayldan kalitni o'qiydi
    (android / "key.properties").write_text(
        f"storeFile={store}\n"
        f"storePassword={store_password}\n"
        f"keyAlias={alias}\n"
        f"keyPassword={key_password}\n",
        encoding="utf-8",
    )

    kts = android / "app" / "build.gradle.kts"
    groovy = android / "app" / "build.gradle"

    if kts.exists():
        text = kts.read_text(encoding="utf-8")
        text = KTS_HEADER + text.replace("android {", KTS_SIGNING, 1)
        text = text.replace(
            'signingConfig = signingConfigs.getByName("debug")',
            'signingConfig = signingConfigs.getByName("release")',
        )
        kts.write_text(text, encoding="utf-8")
        print("build.gradle.kts imzolashga sozlandi")
        return 0

    if groovy.exists():
        text = groovy.read_text(encoding="utf-8")
        text = GROOVY_HEADER + text.replace("android {", GROOVY_SIGNING, 1)
        text = text.replace(
            "signingConfig signingConfigs.debug",
            "signingConfig signingConfigs.release",
        )
        groovy.write_text(text, encoding="utf-8")
        print("build.gradle imzolashga sozlandi")
        return 0

    print("build.gradle topilmadi.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
