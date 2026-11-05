import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function PrivacyPage() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return <main className="privacy-page">
    <Link to="/">← Koleksiyonum’a dön</Link>
    <h1>Gizlilik Politikası</h1>
    <p>Gizlilik politikamız hazırlanıyor. Bu sayfa henüz tamamlanmış bir KVKK aydınlatma metni değildir.</p>
    <h2>Aktivite kayıtları</h2>
    <p>Yorumlar içerik sahibi ve onun arkadaşları tarafından görülebilir. Anonim yorumlarda yazarın kimliği ve yorum tepkilerinde tepki verenin kimliği diğer üyelere gösterilmez. Yorum yazarı ve içerik sahibi yorumu silebilir. Silinen yorum listeden kaldırılır; altındaki cevaplar korunur.</p>
    <p>Hizmetin güvenliği, kötüye kullanımın incelenmesi ve sorunların giderilmesi için içerik ekleme, düzenleme ve silme; ilerleme, tepki, arkadaşlık ve profil değişiklikleri işlem zamanlarıyla kaydedilir. Tepkiyi veren kişi diğer üyelere gösterilmez.</p>
    <p>Giriş yapmışken siteyi açman ve görünür sekmedeki etkileşimlerin üzerinden yaklaşık ziyaret ve son aktiflik bilgisi tutulur. Yazdığın tuşların içeriği, şifren, oturum anahtarların ve özel notlarının tam metni bu aktivite kayıtlarına alınmaz.</p>
    <p>Aktivite kayıtları diğer üyelerle paylaşılmaz. Aktivite geçmişi için saklama süresi 90 gündür; süresi dolan kayıtlar günlük temizlikte, zamanlanmış temizlik kurulmamışsa sonraki kayıt sırasında temizlenir. Kimlik doğrulama günlükleri Supabase tarafından ayrıca tutulur.</p>
    <p>Hesabın ve kişisel verilerinle ilgili soruların için bize ulaşabilirsin:</p>
    <a href="mailto:koleksiyonum.destek@gmail.com">koleksiyonum.destek@gmail.com</a>
  </main>
}
