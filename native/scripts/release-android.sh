#!/usr/bin/env bash
# ============================================================
# בניית החנות של אנדרואיד, על המחשב שמחזיק את מפתח ההעלאה
# ------------------------------------------------------------
# בודק שמספרי הבנייה מסכימים, מעתיק את קבצי האתר, מסנכרן אותם לתוך
# android/ ובונה את ה-aab (ל-Google Play) ואת ה-apk (להתקנה ישירה
# בטלפון) אל ~/vaadhorim-android/builds/<build>/. שום סיסמה לא מודפסת.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

export JAVA_HOME="${JAVA_HOME:-$HOME/tools/jdk}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/tools/android-sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

build=$(node scripts/app-build.mjs check | sed 's/build //')
[ -f android/keystore.properties ] || {
  echo "חסר native/android/keystore.properties — להעתיק מ-~/vaadhorim-android/keystore.properties (ראו native/README.md)"
  exit 1
}

echo "== build $build: קבצי האתר"
node scripts/copy-web.mjs
npx cap sync android

echo "== build $build: gradle"
( cd android && ./gradlew bundleRelease assembleRelease --no-daemon -q )

out="$HOME/vaadhorim-android/builds/$build"
mkdir -p "$out"
cp android/app/build/outputs/bundle/release/app-release.aab "$out/vaadhorim-$build.aab"
cp android/app/build/outputs/apk/release/app-release.apk "$out/vaadhorim-$build.apk"

echo "== build $build: בדיקה"
tools=$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)
"$tools/aapt2" dump badging "$out/vaadhorim-$build.apk" | grep -E "^package|sdkVersion|targetSdkVersion" | head -3
"$tools/apksigner" verify --print-certs "$out/vaadhorim-$build.apk" | grep -E "SHA-256" | head -1
ls -la "$out"
