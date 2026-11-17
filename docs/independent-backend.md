# Kendi backend'imiz — ilk adım

Bu ortam canlı siteye bağlanmaz. Yerel giriş/kayıt API'si ve test ekranı hazırdır; içerik API'si henüz yoktur.
Node.js backend ve PostgreSQL ayrı container'larda çalışır. İlk şemada users, profiles, items ve friendships tabloları oluşturuldu; gerçek veri aktarılmadı.
Mevcut Vercel/Supabase uygulaması değiştirilmedi.

## Açmak

Docker Desktop açıkken proje klasörünün terminalinde:

```powershell
docker compose -f compose.backend.yaml --env-file .env.backend.local up -d --build
```

- http://localhost:3001/health : Backend çalışıyor mu?
- http://localhost:3001/health/db : Backend PostgreSQL'e gerçekten bağlanabiliyor mu?
- Başarılı veritabanı cevabı: `{"status":"ok","database":"connected"}`.
- Bu bir web arayüzü değil; JSON cevabı görmek normal.
- Docker Desktop Containers: `koleksiyonum-backend-dev`; içinde `db` ve `backend`.

## Dosyalar

- `backend/src/app.js`: HTTP istekleri ve sağlık kontrolleri.
- `backend/src/index.js`: PostgreSQL bağlantı havuzu ve sunucu başlangıcı.
- `backend/package.json` / `package-lock.json`: bağımsız backend bağımlılıkları.
- `backend/Dockerfile`: backend imajı.
- `backend/db/init.sh`: ilk açılışta kısıtlı uygulama kullanıcısını oluşturur.
- `compose.backend.yaml`: iki container, özel ağ, kalıcı disk ve yerel port.
- `.env.backend.local`: otomatik üretilmiş yerel parolalar; Git'e alınmaz, paylaşılmaz.

Veritabanı `collection_dev`, uygulama kullanıcısı `collection_app`.
Uygulama kullanıcısı superuser değildir; henüz tablo yazma/oluşturma yetkisi yoktur.
PostgreSQL portu bilgisayara/internete açılmaz; backend Docker ağı üzerinden bağlanır.
Parolalar yalnızca bu yerel ortam içindir, Supabase şifresi değildir.
Mevcut volume oluştuğunda env dosyasında parola değiştirmek DB parolasını değiştirmez.

## Durdurmak ve verilerin saklanması

```powershell
docker compose -f compose.backend.yaml --env-file .env.backend.local down
```

Bu komut container'ları kaldırır, `koleksiyonum-backend-dev_postgres_data` volume'ünü korur.
`down -v` veya Docker Desktop'ta volume silme, bu yerel veritabanını siler. Volume bir yedek değildir.
Mevcut 8080 adresindeki uygulama başka Compose projesidir ve hâlâ Supabase kullanır.

## Sonraki aşamalar

Yerel kayıt/giriş denemesi: [Oturum rehberi](local-auth.md), http://localhost:3001/auth-lab .

İlk şema ve yetki envanteri için [geçiş haritasını](backend-migration-map.md) oku.

Mevcut kodda Auth (oturum/şifre), tablo işlemleri, RPC fonksiyonları ve Storage çağrıları Supabase'e bağlıdır.
Önce mevcut şema, RLS politikaları, trigger ve RPC'lerin envanteri çıkarılacak.
Ardından sürümlü şema migration'ları, giriş/oturum yönetimi ve kullanıcı bazlı erişim kontrolleri geliştirilecek.
Supabase SQL dosyaları auth.uid(), auth.users ve Storage gibi Supabase parçalarına bağlıdır;
bu boş PostgreSQL'e olduğu gibi topluca çalıştırılmamalıdır.
Arkadaşlık, anonim yorum/tepki, aktivite, admin yetkileri ve fotoğraflar ayrı ayrı taşınacak ve test edilecek.
Gerçek kullanıcı verileri aktarılmadan önce yedek ve geri yükleme denemesi yapılacak.
