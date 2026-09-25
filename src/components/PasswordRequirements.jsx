import { passwordRules } from '../utils/authValidation'

export default function PasswordRequirements({ password, id }) {
  return <div id={id} className="password-requirements">
    <ul>{passwordRules(password).map((rule) => <li key={rule.label} className={rule.met ? 'is-met' : ''}>
      <span aria-hidden="true">{rule.met ? '✓' : '○'}</span> {rule.label}
      <span className="sr-only">{rule.met ? ' — sağlandı' : ' — henüz sağlanmadı'}</span>
    </li>)}</ul>
    <p>Başka hesaplarda kullanmadığın uzun bir şifre seç. Sembol ve boşluk da kullanabilirsin.</p>
  </div>
}
