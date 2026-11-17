const message = document.getElementById('message')
let token = '', kind = ''
async function refresh() {
  const response = await fetch('/auth/session')
  const data = await response.json()
  document.getElementById('session').textContent = response.ok ? `${data.user.display_name} (@${data.user.username})` : response.status === 401 ? 'Açık oturum yok.' : 'Oturum kontrol edilemedi.'
}
async function post(path, data) {
  const response = await fetch('/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'İşlem tamamlanamadı.')
  return result
}
async function run(action) {
  document.querySelectorAll('button').forEach(button=>{button.disabled=true})
  message.textContent=''
  try { await action(); await refresh() } catch(error) { message.textContent=error.message }
  finally { document.querySelectorAll('button').forEach(button=>{button.disabled=false}) }
}
for (const id of ['register','login']) document.getElementById(id).addEventListener('submit',event=>{
  event.preventDefault()
  const form=event.currentTarget, data=Object.fromEntries(new FormData(form))
  if (id==='register') data.username=data.username.replace(/[A-Z]/g,c=>c.toLowerCase())
  run(async()=>{
    await post(id,data); form.reset()
    message.textContent=id==='register' ? 'Doğrulama bağlantısını e-posta kutunda kontrol et. Gerekiyorsa spam klasörüne de bak.' : 'Giriş başarılı.'
  })
})
document.getElementById('request-link').addEventListener('submit',event=>{
  event.preventDefault()
  const data=Object.fromEntries(new FormData(event.currentTarget)), action=event.submitter.value
  run(async()=>{const result=await post(action,data);message.textContent=result.message})
})
document.getElementById('logout').addEventListener('click',()=>run(async()=>{await post('logout',{});message.textContent='Oturum kapatıldı.'}))
document.getElementById('action-form').addEventListener('submit',event=>{
  event.preventDefault()
  const form=event.currentTarget, data=Object.fromEntries(new FormData(form))
  run(async()=>{
    if (!token) throw new Error('E-postadaki bağlantıyı yeniden aç.')
    await post(kind==='verify'?'verify-email':'reset-password',{...data,token})
    token=''; form.reset(); document.getElementById('action-panel').hidden=true
    message.textContent='İşlem tamamlandı. Belirlediğin şifreyle giriş yapabilirsin.'
  })
})
function readLink() {
  const params=new URLSearchParams(location.hash.slice(1))
  kind=params.has('verify')?'verify':params.has('reset')?'reset':''
  const value=params.get(kind)
  if (!kind) return
  history.replaceState(null,'',location.pathname)
  if (!/^[a-f0-9]{64}$/.test(value || '')) {message.textContent='Bağlantı geçersiz.';return}
  token=value
  document.getElementById('action-title').textContent=kind==='verify'?'E-postanı doğrula':'Şifreni sıfırla'
  document.getElementById('action-panel').hidden=false
}
window.addEventListener('hashchange',readLink)
readLink()
refresh().catch(()=>{message.textContent='Sunucuya ulaşılamadı.'})
