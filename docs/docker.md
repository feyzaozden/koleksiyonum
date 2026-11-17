# Docker ile Koleksiyonum

OVH zorunlu değil. Docker çalıştırabilen bir Linux VPS kullanabiliriz.
Bu kurulum uygulamayı paketler; veritabanı, Auth ve Storage Supabase'de kalır.

Docker Desktop açıkken proje terminalinde:

```powershell
docker compose --env-file .env --env-file .env.local up -d --build
docker compose --env-file .env --env-file .env.local ps
```

Tarayıcı: http://localhost:8080 . Vite'ın 5173 portundan bağımsızdır.
Health endpoint: http://localhost:8080/healthz . Bu kontrol veritabanı erişimini doğrulamaz.
İlk build Node imajını ve npm paketlerini indirir, birkaç dakika sürebilir.
Docker Desktop Images bölümünde `koleksiyonum:local`, Containers bölümünde `koleksiyonum-local` görünür.

Bu projede Supabase'in herkese açık ayarları `.env`, sunucu anahtarları `.env.local` dosyasından okunur. İkinci dosya aynı adlı değişkenleri geçersiz kılar.
Mevcut Supabase bilgileri canlı projeye aitse BU ORTAMDAKİ EKLEME/SİLMELER DE CANLI VERİLERİ ETKİLER.
Bağımsız deneme için ayrı Supabase projesinin bilgilerini kullan. Giriş ve şifre sıfırlama yönlendirmeleri için Supabase Auth URL Configuration'a deneme adresini ekle.

```powershell
# Sonraki kod değişikliklerini imaja almak:
docker compose --env-file .env --env-file .env.local up -d --build
# Durdurmak (Supabase verilerini silmez):
docker compose --env-file .env --env-file .env.local down
```

Dockerfile iki aşamalıdır: Node ile Vite derlemesi yapılır, son imaja yalnızca dist ve sunucu kodu alınır.
Node HTTP sunucusu arayüzü ve mevcut dört /api uç noktasını sunar. Vercel dosyaları korunur.
Container root olmayan kullanıcıyla çalışır. Yerel port yalnızca bu bilgisayara açılır.
`.dockerignore` izin listesiyle .env, .git, yedekler ve yerel dosyalar build'e dahil edilmez.
Yalnızca herkese açık Supabase URL ve anon/publishable anahtarı frontend build argümanıdır.
TMDB, YouTube ve Supabase secret anahtarları çalışma anında verilir; imaja yazılmaz.
`docker compose config` ve `docker inspect` ortam sırlarını gösterebilir; çıktılarını paylaşma.

VPS aşamasında HTTPS reverse proxy, alan adı ve GitHub Actions dağıtımı ayrıca kurulacak.
Yerel Compose dosyası tek başına internete HTTPS yayını sağlamaz. İmaj şu aşamada registry'ye gönderilmez.
