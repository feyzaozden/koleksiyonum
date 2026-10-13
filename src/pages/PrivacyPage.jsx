import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function PrivacyPage() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return <main className="privacy-page">
    <Link to="/">← Koleksiyonum’a dön</Link>
    <h1>Gizlilik Politikası</h1>
    <p>Gizlilik politikamız hazırlanıyor. Bu sayfa henüz tamamlanmış bir KVKK aydınlatma metni değildir.</p>
    <p>Hesabın ve kişisel verilerinle ilgili soruların için bize ulaşabilirsin:</p>
    <a href="mailto:koleksiyonum.destek@gmail.com">koleksiyonum.destek@gmail.com</a>
  </main>
}
