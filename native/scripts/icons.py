#!/usr/bin/env python3
"""
כל האייקונים ומסכי הפתיחה של האפליקציה — מתוך קובץ מקור אחד
------------------------------------------------------------
המקור: native/resources/icon-master.png — 1254 פיקסלים, כרטיס מעוגל
על רקע לבן עם צל. זה הציור של אייקון האתר לפני שהוקטן.

אפל ואנדרואיד לא מקבלים אותו כמו שהוא:
- אייקון האייפון חייב להיות ריבוע מלא בלי שקיפות; המערכת מעגלת את
  הפינות בעצמה. כרטיס מעוגל בתוך ריבוע לבן היה נראה ככרטיס בתוך כרטיס.
  לכן חותכים לגבולות הכרטיס וממלאים את הפינות בצבע הכרטיס עצמו.
- אייקון מסתגל באנדרואיד נחתך למעגל או לצורה אחרת לפי היצרן, ורק
  66dp מתוך 108dp מובטחים. לכן הציור מוקטן כך שכולו בתוך האזור הבטוח,
  והרקע סביבו ממשיך את צבע הכרטיס.
- מסך הפתיחה מציג את הכרטיס המעוגל עצמו, בשקיפות סביבו, על צבע הרקע
  של האתר — כמו האייקון שבראש מסך הבית.

הרצה: python3 native/scripts/icons.py (צריך Pillow). הסקריפט כותב ישר
לתוך ios/ ו-android/, ואפשר להריץ אותו שוב בכל פעם שהמקור מתחלף.
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

NATIVE = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
RES = os.path.join(NATIVE, 'resources')
ANDROID_RES = os.path.join(NATIVE, 'android', 'app', 'src', 'main', 'res')
IOS_ASSETS = os.path.join(NATIVE, 'ios', 'App', 'App', 'Assets.xcassets')

# גבולות הכרטיס במקור (נמדדו: שם הצל הכהה הופך לכרטיס הבהיר) ורדיוס הפינה שלו
CARD = (95, 87, 1159, 1159)
CARD_RADIUS = 262
# ריבוע בתוך הכרטיס, מעט פנימה מהקו הכהה שבשוליו
BLEED = (99, 95, 1155, 1151)

SS = 4  # דגימת־יתר לקצוות חלקים בכל מה שמצויר כאן


def save(img, *parts):
    path = os.path.join(*parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    return path


def rounded_mask(size, radius, inset=0):
    big = Image.new('L', (size * SS, size * SS), 0)
    ImageDraw.Draw(big).rounded_rectangle(
        (inset * SS, inset * SS, (size - inset) * SS - 1, (size - inset) * SS - 1),
        radius=radius * SS, fill=255)
    return big.resize((size, size), Image.LANCZOS)


def full_bleed(master):
    """ריבוע מלא: הכרטיס בלי הפינות המעוגלות. כל פיקסל שמחוץ לקשת מקבל
    את הצבע שנמצא עליו פנימה, באותו כיוון מהמרכז של הקשת — כך הפינה
    ממשיכה את המעבר העדין של צבע הכרטיס ולא נראה בה תפר."""
    img = master.crop(BLEED).convert('RGB')
    n = img.width
    px = img.load()
    src = img.copy().load()
    r = CARD_RADIUS - 12          # קצת פנימה מהקשת, שם הצבע נקי מהצל
    sample = r - 16
    for cx, cy, xs, ys in ((r, r, range(0, r), range(0, r)),
                           (n - 1 - r, r, range(n - r, n), range(0, r)),
                           (r, n - 1 - r, range(0, r), range(n - r, n)),
                           (n - 1 - r, n - 1 - r, range(n - r, n), range(n - r, n))):
        for y in ys:
            for x in xs:
                dx, dy = x - cx, y - cy
                d = math.hypot(dx, dy)
                if d <= r:
                    continue
                sx = int(round(cx + dx / d * sample))
                sy = int(round(cy + dy / d * sample))
                px[x, y] = src[sx, sy]
    # ריכוך קל של הפינות בלבד, כדי שהמעבר בין הקרניים לא ייראה כפסים
    soft = img.filter(ImageFilter.GaussianBlur(3))
    corners = Image.new('L', img.size, 255)
    ImageDraw.Draw(corners).rounded_rectangle((0, 0, n - 1, n - 1), radius=r, fill=0)
    img.paste(soft, (0, 0), corners)
    return img


def card(master):
    """הכרטיס המעוגל עצמו, בשקיפות סביבו — למסך הפתיחה ולאייקון הישן של אנדרואיד."""
    x0, y0, x1, y1 = CARD
    side = x1 - x0
    top = (y0 + y1 - side) // 2
    img = master.crop((x0, top, x1, top + side)).convert('RGBA')
    img.putalpha(rounded_mask(side, CARD_RADIUS, inset=3))
    return img


def extend(img, size, scale):
    """התמונה בגודל scale מתוך size, במרכז, על רקע שממשיך את צבע הכרטיס.
    צבע הכרטיס משתנה מלמעלה למטה (כמעט לבן עד סגלגל), ולכן הרקע הוא
    מדרג אנכי שנלקח מהעמודות שבשולי הכרטיס, והציור נמזג לתוכו בשוליים
    רכים — כך אין קו ביניהם. מתיחת פיקסלי הקצה החוצה נראתה כפסים."""
    inner = max(1, int(round(size * scale)))
    small = img.resize((inner, inner), Image.LANCZOS)
    off = (size - inner) // 2

    # צבע כל שורה בשולי הכרטיס: ממוצע של כמה עמודות משני הצדדים
    sp = small.load()
    edge = max(2, inner // 60)
    rows = []
    for y in range(inner):
        acc = [0, 0, 0]
        cols = list(range(edge)) + list(range(inner - edge, inner))
        for x in cols:
            for c in range(3):
                acc[c] += sp[x, y][c]
        rows.append([v / len(cols) for v in acc])
    # החלקה, כדי שפרט קטן שנוגע בשוליים לא יהפוך לפס לרוחב כל האייקון
    k = max(1, inner // 12)
    smooth = []
    for y in range(inner):
        lo, hi = max(0, y - k), min(inner, y + k + 1)
        smooth.append(tuple(int(round(sum(r[c] for r in rows[lo:hi]) / (hi - lo))) for c in range(3)))

    out = Image.new('RGB', (size, size))
    draw = ImageDraw.Draw(out)
    for y in range(size):
        draw.line([(0, y), (size - 1, y)], fill=smooth[min(max(y - off, 0), inner - 1)])

    feather = max(2, inner // 14)
    mask = Image.new('L', (inner, inner), 255)
    mp = mask.load()
    for y in range(inner):
        for x in range(inner):
            d = min(x, y, inner - 1 - x, inner - 1 - y)
            if d < feather:
                mp[x, y] = int(255 * d / feather)
    out.paste(small, (off, off), mask)
    return out


def notification_glyph(px):
    """אייקון ההתראה של אנדרואיד: צללית לבנה אחת על שקיפות — המערכת
    צובעת אותה בעצמה. בית עם גג ולב בחלון, כמו בציור."""
    s = px * SS
    u = s / 24.0                       # יחידה אחת = 1dp מתוך 24
    img = Image.new('L', (s, s), 0)
    d = ImageDraw.Draw(img)
    # גוף הבית
    d.rectangle((5 * u, 11 * u, 19 * u, 21 * u), fill=255)
    # הגג: משולש רחב מהקירות
    d.polygon([(2 * u, 12 * u), (12 * u, 3 * u), (22 * u, 12 * u)], fill=255)
    # לב חלול באמצע הבית
    hx, hy, hr = 12 * u, 15 * u, 1.9 * u
    d.ellipse((hx - 2 * hr, hy - hr, hx, hy + hr), fill=0)
    d.ellipse((hx, hy - hr, hx + 2 * hr, hy + hr), fill=0)
    d.polygon([(hx - 2 * hr + 0.3 * u, hy + 0.5 * u), (hx + 2 * hr - 0.3 * u, hy + 0.5 * u),
               (hx, hy + 3.4 * u)], fill=0)
    alpha = img.resize((px, px), Image.LANCZOS)
    out = Image.new('RGBA', (px, px), (255, 255, 255, 0))
    out.putalpha(alpha)
    return out


DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

# הציור מוקטן כך שהנקודה הרחוקה שלו (פינת המטבע) נכנסת בעיגול של 72dp שרוב
# המשגרים מציגים; ב-0.58 היא בערך 35dp מהמרכז
ADAPTIVE_SCALE = 0.58


def main():
    master = Image.open(os.path.join(RES, 'icon-master.png')).convert('RGB')
    bleed = full_bleed(master)
    rounded = card(master)

    icon = bleed.resize((1024, 1024), Image.LANCZOS)
    save(icon, RES, 'icon-only.png')
    save(icon, IOS_ASSETS, 'AppIcon.appiconset', 'AppIcon-512@2x.png')

    # אנדרואיד: שכבת רקע שמכילה את כל הציור, ושכבה קדמית ריקה. הציור
    # אינו ניתן להפרדה מהרקע שלו, ולכן הוא כולו יושב ברקע.
    adaptive = extend(bleed, 432, ADAPTIVE_SCALE)
    save(adaptive.resize((1024, 1024), Image.LANCZOS), RES, 'icon-adaptive.png')
    for name, k in DENSITIES.items():
        folder = os.path.join(ANDROID_RES, 'mipmap-' + name)
        big = int(108 * k)
        save(adaptive.resize((big, big), Image.LANCZOS), folder, 'ic_launcher_background.png')
        save(Image.new('RGBA', (big, big), (0, 0, 0, 0)), folder, 'ic_launcher_foreground.png')
        # אנדרואיד 7 (לפני האייקון המסתגל): הכרטיס המעוגל, ועיגול לגרסה העגולה
        small = int(48 * k)
        save(rounded.resize((small, small), Image.LANCZOS), folder, 'ic_launcher.png')
        disc = bleed.resize((small, small), Image.LANCZOS).convert('RGBA')
        m = Image.new('L', (small * SS, small * SS), 0)
        ImageDraw.Draw(m).ellipse((0, 0, small * SS - 1, small * SS - 1), fill=255)
        disc.putalpha(m.resize((small, small), Image.LANCZOS))
        save(disc, folder, 'ic_launcher_round.png')
        save(notification_glyph(int(24 * k)), ANDROID_RES, 'drawable-' + name, 'ic_stat_vaad.png')

    # מסך הפתיחה באייפון: הכרטיס ב-120 נקודות, במרכז
    for scale in (1, 2, 3):
        mark = rounded.resize((120 * scale, 120 * scale), Image.LANCZOS)
        save(mark, RES, 'splash-mark@%dx.png' % scale)
        save(mark, IOS_ASSETS, 'SplashMark.imageset', 'splash-mark@%dx.png' % scale)

    # מסך הפתיחה באנדרואיד 12+: האייקון מצויר על 288dp וננעל בעיגול של
    # 192dp, ולכן הכרטיס (150dp) יושב במרכז משטח שקוף של 288dp
    canvas = 288 * 4
    art = int(150 * 4)
    splash = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    splash.paste(rounded.resize((art, art), Image.LANCZOS), ((canvas - art) // 2,) * 2)
    save(splash, ANDROID_RES, 'drawable-nodpi', 'splash_mark.png')

    print('icons: done')


if __name__ == '__main__':
    main()
