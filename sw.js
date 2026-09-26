/* ============================================================
   Service Worker — רק בשביל התראות התזכורת
   ------------------------------------------------------------
   באנדרואיד ובאייפון דף אינטרנט לא יכול להציג התראת מערכת בעצמו,
   רק דרך worker. אין כאן טיפול בבקשות רשת (fetch) ואין מטמון:
   האתר נטען בדיוק כמו קודם, והקבצים תמיד טריים.
   ============================================================ */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

/* לחיצה על ההתראה מחזירה לאפליקציה — לחלון פתוח אם יש, אחרת חדש */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if ('focus' in list[i]) return list[i].focus();
    }
    return self.clients.openWindow('./');
  }));
});
