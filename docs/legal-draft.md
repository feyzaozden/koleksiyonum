# Koleksiyonum — gizlilik ve kullanım koşulları taslağı

Hazırlanma tarihi: 13 Ekim 2026.

**İç değerlendirme taslağıdır; yayımlanmış veya tamamlanmış KVKK aydınlatma metni değildir.** İşleten kişinin adı, isteği doğrultusunda bu dosyada yer almıyor. Veri sorumlusunun kimliği konusu çözümlenmeden metin tam bir aydınlatma metni olarak sunulmamalıdır. Marka ve destek e-postası bu eksikliği kendiliğinden gidermez.

GoSak'ın gizlilik sayfası yalnızca bölüm düzeni açısından incelendi; metni kopyalanmadı. Aşağıdaki açıklamalar Koleksiyonum'un incelenen koduna göre hazırlandı. Canlı hizmet panellerindeki ayarlar ayrıca doğrulanmalıdır.

## Gizlilik politikası için içerik taslağı

### 1. Kapsam ve iletişim

Koleksiyonum; kitap, film ve dizileri kişisel koleksiyonlara ekleme, ilerleme takibi ve kabul edilmiş arkadaşlarla koleksiyon paylaşımı hizmeti sunar. Gizlilik ve hesap işlemleri hakkında iletişim adresi: koleksiyonum.destek@gmail.com.

### 2. İşlenen bilgiler ve kullanım amaçları

- Hesap oluşturma ve giriş: e-posta, kullanıcı adı, Ad Soyad ve kimlik doğrulama bilgileri.
- Profil: seçilen avatar, isteğe bağlı biyografi ve yüklenen profil fotoğrafı.
- Koleksiyon: eklenen içerikler, kişisel notlar, puanlar, başlangıç/bitiş tarihleri ve sayfa/dakika/sezon/bölüm ilerlemesi.
- Arkadaşlık: gönderilen ve alınan istekler, kabul durumu ve ilişkili kullanıcı kimlikleri.
- Oturum ve güvenlik: oturum bilgileri; altyapı hizmetlerinde işlenebilen IP, istek ve hata kayıtları. Kapsam ve saklama süreleri canlı panel ayarlarından doğrulanmalıdır.
- Destek: iletişim adresine gönderilen mesajlar ve talebin çözülmesi için gerekli bilgiler.

Bu bilgiler hesabı çalıştırmak, kullanıcının kayıtlarını saklamak, arkadaşlık paylaşımını sağlamak, hesap güvenliğini korumak ve destek taleplerini karşılamak için kullanılır. Parola, kimlik doğrulama amacıyla Supabase Auth'a iletilir; uygulamanın profil ve koleksiyon tablolarında tutulmaz.

### 3. Diğer kullanıcıların görebildiği bilgiler

Ad Soyad, kullanıcı adı, avatar/profil fotoğrafı ve biyografi giriş yapmış diğer kullanıcılar tarafından görülebilir. Koleksiyonlar, notlar, puanlar ve ilerleme bilgileri kayıt sahibine ve kabul edilmiş arkadaşlarına açıktır. Arkadaşlık isteğinin gönderilmesi tek başına koleksiyon erişimi sağlamaz. Arkadaşlık kaldırıldığında uygulama içindeki koleksiyon erişimi sona erer; daha önce görülmüş veya başka bir kişi tarafından kopyalanmış bilgilerin geri alınması garanti edilemez.

E-posta adresi, uygulamanın diğer kullanıcılara gösterdiği profil alanları arasında yer almaz.

### 4. Hizmet sağlayıcılar ve veri akışı

- Supabase: hesap doğrulama, profil/koleksiyon/arkadaşlık veritabanı ve profil fotoğrafı depolama.
- Vercel: web uygulamasının ve film arama sunucu fonksiyonunun çalıştırılması.
- Resend: önceki kurulum bilgisine göre kayıt doğrulama ve şifre sıfırlama gibi hesap e-postalarının gönderilmesi; canlı SMTP ayarı doğrulanmalı.
- TMDB: film arama sorgusu veya seçilen film kimliği sunucu üzerinden gönderilir. Bu isteklerde kullanıcının e-postası, parolası veya koleksiyon notları TMDB'ye eklenmez. Afişler tarayıcıdan TMDB görsel sunucusuna doğrudan yüklenir; bu bağlantı IP ve teknik istek bilgilerini sağlayıcıya iletir.
- Google Fonts: mevcut tasarım yazı tiplerini Google sunucularından yükler; tarayıcı bu hizmetlere teknik bağlantı kurar.
- Gmail: destek adresine gönderilen mesajlar bu hizmet üzerinden alınır ve yanıtlanır.

Sağlayıcıların veri işleme konumları, alt işleyenleri ve sözleşmeleri ayrıca incelenmelidir. Bu taslak, KVKK madde 9 kapsamında uygun güvencelerin kurulduğunu veya yurt dışına aktarım şartlarının tamamlandığını iddia etmez. Sadece kayıt kutucuğunun işaretlenmesi bu konuyu çözmez.

### 5. Tarayıcı depolaması ve ölçümleme

Mevcut Supabase istemcisinin oturum yönetimi tarayıcı yerel depolamasından yararlanır. Bu depolama çerezle aynı teknik mekanizma değildir. İncelenen kaynak kodunda Google Analytics, Vercel Analytics veya reklam entegrasyonu bulunmadı. Bu bulgu, canlı panellerde ya da başka bir katmanda ölçümleme bulunmadığını tek başına kanıtlamaz. Reklam/analiz kullanımı işletenden doğrulanmadan kesin bir yokluk beyanı yayımlanmamalıdır.

### 6. Saklama ve silme

Hesap açıkken profil ve koleksiyon kayıtları hizmetin sunulması için saklanır. Kullanıcı koleksiyon kayıtlarını uygulama içinden silebilir, profilini düzenleyebilir ve profil fotoğrafını kaldırabilir. Mevcut profil ekranında tüm hesabı silme özelliği yoktur.

Hesap kapatma ve kişisel veriler hakkında talepler destek adresine iletilebilir. Talepleri karşılamak için hesap, veritabanı, depolama, hizmet sağlayıcı kayıtları ve yedekler birlikte ele alınmalıdır. Log/yedek süreleri ve silme yöntemi belirlenmeden "anında tamamen silinir" veya "iki yıl saklanır" gibi bir taahhüt eklenmemelidir.

### 7. Haklar ve başvuru

Yayımlanacak aydınlatma metni; kişisel veri işlenip işlenmediğini öğrenme, bilgi isteme, amaç ve alıcıları öğrenme, düzeltme ve şartları varsa silme/yok etme talebi, bu işlemlerin alıcılara bildirilmesini isteme, yalnızca otomatik analiz sonucunda aleyhe çıkan sonuca itiraz ve hukuka aykırı işlemeden doğan zararın giderilmesini talep etme haklarını açıklamalıdır.

Başvuru kanalı olarak destek adresi kullanılabilir. Kimlik doğrulaması, kayıtlı e-posta ile başvuru ve kanuni cevap sürelerini karşılayan süreç oluşturulmalıdır. Gereksiz kimlik belgesi istenmemelidir.

### 8. Tamamlanması gereken hukuki bilgiler

Veri sorumlusunun kimliği, her işleme amacıyla bağlantılı somut hukuki sebep, uluslararası aktarımların dayanağı ve saklama/silme uygulamaları kesinleştirilmelidir. Sözleşmenin ifası veya meşru menfaat gibi gerekçeler her veri için otomatik olarak varsayılmamalıdır. Nihai metin için KVKK konusunda hukukçu incelemesi önerilir.

## Kullanım koşulları için ayrı taslak

1. Koleksiyonum, kişisel kitap/film/dizi takibi ve arkadaşlarla paylaşım için kullanılır; film izleme veya kitapların tam metnine erişim hizmeti değildir.
2. Kullanıcı, erişebildiği bir e-posta adresi kullanmalı ve hesabının şifresini korumalıdır. Başka kişilerin kimliğine bürünmemeli veya hesaplarına izinsiz erişmeye çalışmamalıdır.
3. Profil, fotoğraf ve notlarda başkalarının haklarını ihlal eden, tehdit veya taciz içeren içerikler paylaşılmamalıdır. Kullanıcı yalnızca paylaşma hakkına sahip olduğu fotoğraf ve içerikleri yüklemelidir.
4. Arkadaşlık kabul edildiğinde koleksiyon bilgilerinin karşılıklı görülebildiği dikkate alınmalıdır. Hassas veya paylaşılması istenmeyen bilgiler profil ve not alanlarına yazılmamalıdır.
5. Dış kaynaklardan gelen film bilgileri eksik veya hatalı olabilir. Kullanıcı, kaydetmeden önce otomatik doldurulan alanları kontrol edebilir.
6. Hizmette bakım veya teknik kesinti olabilir. Bu açıklama kullanıcının kanuni haklarından feragat ettiği anlamına gelmez.
7. Destek, kötüye kullanım bildirimi ve hesap kapatma talepleri koleksiyonum.destek@gmail.com adresine iletilebilir. İnceleme ve hesap kapatma prosedürü yayımdan önce belirlenmelidir.
8. Önemli koşul değişiklikleri kullanıcılara duyurulmalıdır. Eski kullanıcılara yeni metni daha önce kabul etmiş gibi bir kayıt atanmamalıdır.

## Uygulamaya ekleme planı

- Herkesin giriş yapmadan okuyabileceği ayrı gizlilik ve kullanım koşulları sayfaları.
- Footer'da bu iki sayfaya bağlantı ve destek adresi.
- Kayıt formunda ayrı kullanım koşulları kabul kutusu; başlangıçta işaretli olmamalı.
- Aydınlatma metnine kayıt öncesinde erişim; "tüm veri işlemlerine rıza" içeren birleşik bir kutu kullanılmamalı.
- Kabul edilen koşulların sürümü ve sunucu zamanı ile kayıt tutulması; kullanıcı tarafından değiştirilebilen profil metadata'sı tek başına güvenilir bir kabul kaydı sayılmamalı.
- Mevcut hesapların kayıtlarını koruma; yeni koşullar için gerekiyorsa ayrı bilgilendirme/kabul akışı.

Bu aşamada uygulama ekranları, kayıt akışı ve veritabanı değiştirilmedi. Taslak canlıya gönderilmedi.

## İncelenen kaynaklar

- Bölüm düzeni örneği: https://gosak.com.tr/privacy
- KVKK aydınlatma yükümlülüğü: https://www.kvkk.gov.tr/Icerik/2033/Aydinlatma-Yukumlulugu-
- Aydınlatma ve açık rızanın ayrılığı: https://www.kvkk.gov.tr/Icerik/4132/aydinlatma-yukumlulugunun-yerine-getirilmesinde-uyulacak-usul-ve-esaslar-hakkinda-teblig
- Yurt dışına aktarım standart sözleşmeleri: https://www.kvkk.gov.tr/Icerik/7938/Standart-Sozlesmeler-ve-Baglayici-Sirket-Kurallarina-Iliskin-Dokumanlar-Hakkinda-Kamuoyu-Duyurusu
