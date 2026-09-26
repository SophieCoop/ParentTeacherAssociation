#!/usr/bin/env bash
# ============================================================
# בניית החנות של אייפון, על המק
# ------------------------------------------------------------
# בודק שמספרי הבנייה מסכימים, מעתיק את קבצי האתר ומסנכרן אותם, בונה
# ארכיון חתום ל-App Store ומעלה אותו ל-TestFlight עם מפתח ה-API של
# App Store Connect — אותו מפתח צוות שפטק משתמש בו.
#
# רץ בתוך הסשן הגרפי של המק (מחזיק המפתחות נעול ל-SSH):
#
#   sudo launchctl asuser "$(id -u)" sudo -u "$USER" -i bash -c \
#     'cd ~/Projects/ParentTeacherAssociation/native && scripts/release-ios.sh'
#
# צריך: את המפתח ב-~/petek-ios/asc/ ‏(AuthKey_<KEY_ID>.p8) ואת ASC_KEY_ID
# ו-ASC_ISSUER_ID בקובץ ~/petek-ios/asc/env (ASC_DIR משנה את התיקייה).
# עם UPLOAD=no הארכיון מיוצא לקובץ ‎.ipa במקום שיועלה.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH=/usr/local/bin:/opt/homebrew/bin:$PATH

build=$(node scripts/app-build.mjs check | sed 's/build //')

echo "== build $build: קבצי האתר"
node scripts/copy-web.mjs
npx cap sync ios
[ -f ios/App/App/public/index.html ] || { echo "קבצי האתר לא הגיעו ל-ios/App/App/public"; exit 1; }

out="$HOME/vaadhorim-ios/builds/$build"
mkdir -p "$out"
archive="$out/App.xcarchive"

echo "== build $build: archive"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination "generic/platform=iOS" -archivePath "$archive" \
  -allowProvisioningUpdates DEVELOPMENT_TEAM=9U68Z6M77V CODE_SIGN_STYLE=Automatic \
  archive | grep -E "error:|warning: .*signing|ARCHIVE (SUCCEEDED|FAILED)" || true
[ -d "$archive" ] || { echo "לא נוצר ארכיון"; exit 1; }

if [ "${UPLOAD:-yes}" = "no" ]; then
  echo "== build $build: ‎.ipa"
  sed 's#<string>upload</string>#<string>export</string>#' ios/exportOptions.plist > "$out/exportOptions.plist"
  xcodebuild -exportArchive -archivePath "$archive" -exportOptionsPlist "$out/exportOptions.plist" \
    -exportPath "$out/export" -allowProvisioningUpdates | grep -E "error:|EXPORT (SUCCEEDED|FAILED)" || true
  ls -la "$out/export"
  exit 0
fi

asc="${ASC_DIR:-$HOME/petek-ios/asc}"
# shellcheck disable=SC1091
source "$asc/env"
key="$asc/AuthKey_${ASC_KEY_ID}.p8"
[ -f "$key" ] || { echo "$key חסר"; exit 1; }
echo "== build $build: העלאה ל-TestFlight"
xcodebuild -exportArchive -archivePath "$archive" -exportOptionsPlist ios/exportOptions.plist \
  -exportPath "$out/export" -allowProvisioningUpdates \
  -authenticationKeyPath "$key" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
  | grep -E "error:|EXPORT (SUCCEEDED|FAILED)|Upload" || true
