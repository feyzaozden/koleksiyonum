# OVH test yayını — ilk bağlantı

Sunucu: 15.235.94.106, Ubuntu 26.04, kullanıcı ubuntu. SSH anahtarı ve UFW yapılandırıldı.
Cloudflare test A kaydı bu IPv4'e yönlenmeli; DNS only. Aynı ad için başka sunucuya yönlenen AAAA olmamalı.
Ana alan adı ve www mevcut Vercel yayınında kalır.

Bu ilk yayın tam Koleksiyonum uygulaması değildir. Yalnız karşılama metni, /health ve /health/db dışarı açıktır.
Caddy bütün auth yollarını, yerel test ekranını ve posta kutusunu 404 ile kapatır.
Backend ayrıca AUTH_LOCAL_REGISTRATION=false kullanır. Gerçek e-posta ve kullanıcı aktarımı yoktur.
Supabase anahtarları, yerel hesaplar ve yerel .env dosyaları bu pakete alınmaz.

## Paketi hazırlamak (bilgisayarda PowerShell, proje klasörü)

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
tar -czf backups/koleksiyonum-staging.tar.gz compose.staging.yaml deploy/staging backend/Dockerfile backend/.dockerignore backend/package.json backend/package-lock.json backend/src backend/migrations backend/db backend/pages backend/lab/.keep
```

Staging'de test ekranı servis edilmez. Dockerfile COPY lab için yalnız boş dizin işaretçisi (.keep) pakete alınır.

## Göndermek (bilgisayarda PowerShell)

```powershell
scp -i "$env:USERPROFILE\.ssh\koleksiyonum_ed25519" backups/koleksiyonum-staging.tar.gz ubuntu@15.235.94.106:~/koleksiyonum-staging.tar.gz
```

## Başlatmak (SSH ile sunucu terminali)

```bash
mkdir -p ~/koleksiyonum-staging
tar -xzf ~/koleksiyonum-staging.tar.gz -C ~/koleksiyonum-staging
cd ~/koleksiyonum-staging
sudo sh deploy/staging/start.sh
```

Betik ilk kurulumda iki farklı rastgele veritabanı parolası üretir, yalnız sunucudaki .env.staging.local
dosyasına yazar (root, 600). Parolaları göstermez. Bu dosyayı şifreli yedeğine ayrıca ekle, Git'e gönderme.
Var olan env dosyasını değiştirmez. DB volume varken env kayıpsa durur.
Migration ve Caddy yapılandırması doğrulanmadan yayın başlatılmaz.
Veritabanının adı collection_dev olsa da yerel DB'den tamamen ayrı staging volume'üdür.
postgres_data, caddy_data ve caddy_config kalıcıdır; down -v bunları siler, kullanma.

## Kontrol

- https://test.koleksiyonum.com.tr/ karşılama metni
- /health/db → database: connected
- /auth-lab, /auth/local-inbox, /auth/register → 404
- HTTP adresi HTTPS'e yönlenmeli.

Yalnız Caddy 80/443 portlarını dışarı yayınlar. DB 5432, backend 3000 ve Caddy yönetim portu yayınlanmaz.
Docker yayınlanan portlarda UFW'yi aşabildiğinden DB/backend için ports ekleme.
Caddy TLS sertifikasını otomatik alır/yeniler; caddy_data korunmalıdır.
Kaynak: https://caddyserver.com/docs/automatic-https

Sorun olduğunda sunucuda:

```bash
sudo docker compose -f compose.staging.yaml --env-file .env.staging.local ps
sudo docker compose -f compose.staging.yaml --env-file .env.staging.local logs --tail 40 caddy backend
```

`docker compose config` veya `docker inspect` çıktısını paylaşma; parolaları içerebilir.
Henüz CI/CD yok; bu ilk kurulum elle aktarılır. Sonraki aşamada GitHub Actions, sürümlü imajlar,
gerçek e-posta, frontend ve veri aktarımı ayrı ayrı hazırlanır.
