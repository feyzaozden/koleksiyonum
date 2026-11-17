# GitHub Actions ile test sunucusuna yayın

Hazırlanan workflow: `.github/workflows/staging.yml`. Henüz GitHub'a gönderilmedi ve secrets kurulmadı.

- `staging` dalına push → lint + testler → Docker build → SSH ile imaj gönderimi → migration → backend değişimi → sağlık kontrolü.
- master/staging hedefli PR → yalnız test. PR kodu sunucu anahtarını alamaz.
- Deploy yalnız staging dalından yapılır. Ana siteyi güncellemez. master'a push mevcut Vercel yayınını tetikleyebileceğinden bu çalışma staging dalından gönderilmeli.
- Docker imajı commit SHA ile etiketlenir. Registry/PAT gerekmez, sıkıştırılmış imaj SSH ile taşınır.
- GitHub concurrency ve sunucudaki flock eşzamanlı deploy'u önler.
- Uygulama sağlık kontrolü başarısızsa önceki imaj geri alınır. Migrationlar otomatik geri alınmaz; geriye uyumlu olmalı. Migration öncesi yedek, gerçek veri taşınmadan ayrıca kurulmalı.
- HTTPS dış kontrolü başarısız olursa job başarısız olur; ağ/DNS hatasında otomatik DB/imaj değişikliği yapılmaz.
- Caddy, Compose, init.sh ve root deploy betiği CI tarafından güncellenmez. Bunlar incelenerek elle güncellenir.
- Eski Docker imajları otomatik silinmez; disk kullanımını `sudo docker system df` ile izle. Volume prune yapma.

## 1. Sunucudaki dosyaları bir kez güncelle

Bilgisayarda proje klasöründen PowerShell:

```powershell
scp -i "$env:USERPROFILE\.ssh\koleksiyonum_ed25519" .\compose.staging.yaml ubuntu@15.235.94.106:~/koleksiyonum-staging/compose.staging.yaml
scp -i "$env:USERPROFILE\.ssh\koleksiyonum_ed25519" .\deploy\staging\deploy-ci.sh ubuntu@15.235.94.106:~/koleksiyonum-staging/deploy/staging/deploy-ci.sh
scp -i "$env:USERPROFILE\.ssh\koleksiyonum_ed25519" .\deploy\staging\start.sh ubuntu@15.235.94.106:~/koleksiyonum-staging/deploy/staging/start.sh
scp -i "$env:USERPROFILE\.ssh\koleksiyonum_ed25519" .\deploy\staging\install-ci.sh ubuntu@15.235.94.106:~/koleksiyonum-staging/deploy/staging/install-ci.sh
```

Sunucu terminalinde:

```bash
cd ~/koleksiyonum-staging
sudo sh deploy/staging/install-ci.sh
```

Bu betik Compose ve shell dosyalarını doğrular, yayın betiğini root sahipliğiyle kurar.
Yalnız `/usr/local/sbin/koleksiyonum-deploy` komutuna şifresiz sudo kuralı ekler; kuralı kurmadan önce `visudo` ile doğrular.
Mevcut diğer sudo izinlerini kaldırmaz. Uygulamayı yeniden başlatmaz ve veritabanını değiştirmez.
Deploy rolü Docker imajı çalıştırabildiği için güçlü yönetim yetkisine sahiptir. Repo ve SSH anahtarı erişimini yalnız güvenilir kişilere ver.

## 2. Ayrı bir otomasyon anahtarı oluştur

Kişisel yönetim anahtarını GitHub'a yükleme. Bilgisayarda:

```powershell
Test-Path "$env:USERPROFILE\.ssh\koleksiyonum_actions_ed25519"
```

False ise:

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\koleksiyonum_actions_ed25519" -C "koleksiyonum-actions"
```

Otomasyon için passphrase sorularında Enter (boş) kullan. True ise üzerine yazma.
Açık anahtarın içeriğini `restrict ` önekiyle sunucudaki `~/.ssh/authorized_keys` dosyasına ayrı satır olarak ekle.
Bilgisayardaki PowerShell'de (kişisel anahtarın parolasını sorabilir):

```powershell
$actionsPublic = (Get-Content "$env:USERPROFILE\.ssh\koleksiyonum_actions_ed25519.pub" -Raw).Trim()
"restrict $actionsPublic" | ssh -o IdentitiesOnly=yes -i "$env:USERPROFILE\.ssh\koleksiyonum_ed25519" ubuntu@15.235.94.106 'umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys; chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys'
ssh -o BatchMode=yes -o IdentitiesOnly=yes -i "$env:USERPROFILE\.ssh\koleksiyonum_actions_ed25519" ubuntu@15.235.94.106 'sudo -n -l /usr/local/sbin/koleksiyonum-deploy'
```

İkinci komut şifre sormadan izin bilgisini göstermeli; uygulamayı yayınlamaz.
Bu önek port forwarding, PTY ve agent forwarding'i kapatır; komut/SFTP erişimi devam eder.
Özel anahtarı sohbete gönderme. GitHub Environment secret'a doğrudan yapıştır.

## 3. GitHub staging environment

Repository → Settings → Environments → New environment → `staging`.
Deployment branches/tags bölümünde yalnız `staging` dalını seç (plan destekliyorsa).
İki environment secret ekle:

| İsim | Değer |
|---|---|
| STAGING_SSH_PRIVATE_KEY | Yeni otomasyon anahtarı: BEGIN/END satırları dahil, `.pub` olmayan dosya |
| STAGING_SSH_KNOWN_HOSTS | Doğrulanmış sunucunun `15.235.94.106 ssh-ed25519 AAAA...` satırı |

Özel anahtarı terminale/sohbete yazdırmadan panoya kopyalamak için kendi PowerShell'inde:

```powershell
Get-Content "$env:USERPROFILE\.ssh\koleksiyonum_actions_ed25519" -Raw | Set-Clipboard
```

GitHub secret alanına yapıştırıp kaydettikten sonra `Set-Clipboard -Value ''` ile panoyu temizle.

Sunucu anahtarını mevcut güvenilir SSH oturumunda `sudo cat /etc/ssh/ssh_host_ed25519_key.pub` ile al.
Bu **açık** host anahtarının başına `15.235.94.106 ` ekleyerek known_hosts secret'ına koy.
Parmak izi `sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` ile görülebilir;
ilk bağlantıda kaydettiğin SHA256:oAUi9nX2LPoMXKOGZ0NkKwWjwsePa2cwm9dbmKEbMPc ile karşılaştır.
Workflow ssh-keyscan'e güvenmez, StrictHostKeyChecking açıktır. Sunucu yeniden kurulursa kimliği tekrar doğrula.

## 4. İlk yayın

Önce `git status` ile dosyaları gözden geçir. `.env*` gizli dosyaları, anahtarlar, backups ve yerel hesap verileri commit edilmez.
Bu dal yeni ise `git switch -c staging`. Varsa mevcut dalı kontrol et; zorla sıfırlama yapma.
İlgili dosyaları commit edip `git push -u origin staging` ile gönder.
Actions → Backend CI and staging deployment → test ve deploy sonuçlarını kontrol et.
Environment secrets yoksa deploy çalışmaz. workflow_dispatch düğmesi ancak workflow varsayılan dalda da bulunuyorsa görünebilir; ilk yayın staging push ile yapılır.

## Sonraki elle başlatmalar

CI sonrası `start.sh` varsayılan eski staging etiketine dönmemeli. Yeniden başlatmak için:

```bash
cd ~/koleksiyonum-staging
sudo docker compose -f compose.staging.yaml --env-file .env.staging.local restart backend
```

Yeni SHA imajları sunucuda bulunur. `.deployed-image` son başarılı imajın adını tutar, parola içermez.
GitHub'a erişimi olmayan bu çalışma ortamında secrets kurulumu, push ve ilk uçtan uca yayın doğrulanamadı.
