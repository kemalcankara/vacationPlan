# Londra Tatil Planlayıcı

Tek sayfalık sade Londra tatil planlayıcı. Ana ekran 20-26 July günlerini yan yana büyük kutular halinde gösterir; her günün altında yapılacaklar alt alta görünür. Plan detayları kutuya tıklanınca popup'ta açılır, yorumlar kutudaki yorum simgesinden ayrı popup'ta tarih ve kişi bilgisiyle izlenir. Yerelde `localStorage` ile çalışır; Firebase config eklersen Firestore üzerinden linki alan kişiler aynı planı düzenleyebilir.

## Yerelde çalıştırma

```bash
python3 -m http.server 8080
```

Sonra `http://127.0.0.1:8080` adresini aç.

## Ortak düzenleme

1. Firebase Console'da ücretsiz Spark planlı bir proje oluştur.
2. Web App ekle ve verilen config objesini [firebase.config.js](firebase.config.js) içindeki `window.LONDON_PLANNER_FIREBASE = null;` satırına koy.
3. Firestore Database'i etkinleştir.
4. Başlangıç için basit Firestore kuralı:

```txt
// Firestore rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /plans/{planId} {
      allow read, write: if true;
    }
  }
}

```

Bu kural linki bilen herkesin düzenlemesine izin verir. Sadece davet ettiklerinle paylaşacağın küçük bir tatil planı için basit başlangıçtır; public yayında kullanacaksan auth kuralı eklemek gerekir.

Tamamen ücretsiz kalmak için Firebase Storage kullanılmıyor. Bilet veya rezervasyon çıktılarını Google Drive/iCloud/Dropbox gibi ücretsiz bir yere koyup paylaşılabilir linkini plana ekle.

## Ücretsiz host

En düz yol Firebase Hosting:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

Alternatif olarak aynı klasörü Netlify, Vercel veya GitHub Pages'e statik site olarak yükleyebilirsin. Ortak düzenleme için yine Firebase config gerekir.

## Dosyalar

- [index.html](index.html): 20-26 gün board'u
- [styles.css](styles.css): Arayüz
- [app.js](app.js): Plan, yorum, link ekleri ve Firebase senkronizasyonu
- [data/trip-events.js](data/trip-events.js): Biletlerden oluşturulan başlangıç planı
- [firebase.config.js](firebase.config.js): Bulut bağlantısı ayarı
- [assets/london-planner-hero.png](assets/london-planner-hero.png): Oluşturulan Londra görseli
