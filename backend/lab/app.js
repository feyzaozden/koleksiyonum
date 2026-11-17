const message = document.getElementById('message')
async function refresh() {
  const response = await fetch('/auth/session')
  const data = await response.json()
  document.getElementById('session').textContent = response.ok ? `${data.user.display_name} (@${data.user.username}) — ${data.user.email} — ${data.user.email_verified ? 'Doğrulanmış' : 'Doğrulanmamış'}` : response.status === 401 ? 'Açık oturum yok.' : 'Oturum kontrol edilemedi.'
}
async function submit(path, data) {
  const response = await fetch(path, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(data) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'İşlem başarısız.')
  return result
}
async function run(action) {
  document.querySelectorAll('button').forEach(button => { button.disabled = true })
  message.textContent = ''
  try { await action(); await refresh() } catch (error) { message.textContent = error.message }
  finally { document.querySelectorAll('button').forEach(button => { button.disabled = false }) }
}
for (const name of ['register','login']) document.getElementById(name).addEventListener('submit', event => {
  event.preventDefault()
  const form = event.currentTarget
  run(async () => {
    const result = await submit('/auth/' + name, Object.fromEntries(new FormData(form)))
    form.reset(); message.textContent = result.verification_required ? 'Hesabın oluşturuldu. Test posta kutusundaki bağlantıyla e-postanı doğrula, ardından giriş yap.' : 'Giriş başarılı.'
    await inbox()
  })
})
document.getElementById('logout').addEventListener('click', () => run(async () => { await submit('/auth/logout',{}); message.textContent = 'Oturum kapatıldı.' }))
document.getElementById('refresh').addEventListener('click', () => run(refresh))
document.querySelector('[name="username"]').addEventListener('input', event => { event.target.value = event.target.value.replace(/[A-Z]/g,c => c.toLowerCase()) })
refresh().catch(() => { message.textContent = 'Backend bağlantısı kurulamadı.' })

async function inbox() {
  const response = await fetch('/auth/local-inbox',{headers:{'X-Local-Lab':'1'}})
  const data = await response.json()
  if (!response.ok) throw new Error(data.error)
  const list = document.getElementById('inbox')
  list.replaceChildren()
  for (const mail of data.messages) {
    const item = document.createElement('li'), link = document.createElement('a')
    link.href = mail.link
    link.textContent = `${mail.email}: ${mail.purpose === 'verify' ? 'E-postayı doğrula' : 'Şifreyi sıfırla'}`
    item.append(link); list.append(item)
  }
}
let actionToken = '', actionKind = ''
function readLink() {
  const params = new URLSearchParams(location.hash.slice(1))
  const kind = params.has('verify') ? 'verify' : params.has('reset') ? 'reset' : ''
  const token = params.get(kind)
  if (!kind || !/^[a-f0-9]{64}$/.test(token || '')) return
  actionToken = token; actionKind = kind
  history.replaceState(null,'',location.pathname)
  document.getElementById('verify-panel').hidden = kind !== 'verify'
  document.getElementById('reset-panel').hidden = kind !== 'reset'
  document.getElementById(kind + '-panel').scrollIntoView({behavior:'smooth'})
}
document.getElementById('request-link').addEventListener('submit',event => {
  event.preventDefault()
  const data = Object.fromEntries(new FormData(event.currentTarget))
  const action = event.submitter.value
  run(async () => { const result = await submit('/auth/' + action,data); message.textContent = result.message; await inbox() })
})
document.getElementById('inbox-refresh').addEventListener('click',() => run(inbox))
document.getElementById('verify').addEventListener('click',() => run(async () => {
  if (actionKind !== 'verify') return
  await submit('/auth/verify-email',{token:actionToken})
  actionToken = ''; document.getElementById('verify-panel').hidden = true
  message.textContent = 'E-posta doğrulandı. Şimdi giriş yapabilirsin.'
}))
document.getElementById('reset-password').addEventListener('submit',event => {
  event.preventDefault()
  const form = event.currentTarget
  const data = Object.fromEntries(new FormData(form))
  run(async () => {
    if (actionKind !== 'reset') return
    await submit('/auth/reset-password',{...data,token:actionToken})
    actionToken = ''; form.reset(); document.getElementById('reset-panel').hidden = true
    message.textContent = 'Şifre değiştirildi ve eski oturumlar kapatıldı. Yeni şifrenle giriş yap.'
  })
})
window.addEventListener('hashchange',readLink)
readLink()
inbox().catch(() => { message.textContent = 'Test posta kutusu yüklenemedi.' })
