import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { get } from 'node:http'
import { PGlite } from '@electric-sql/pglite'
import { createApp } from '../backend/src/app.js'

test('verification and password recovery: one use, expiry, isolation and session revocation',async () => {
  const db = new PGlite()
  let app
  try {
    await db.exec('CREATE ROLE collection_app')
    for (const file of ['001_core.sql','002_auth.sql','003_auth_links.sql']) await db.exec(await readFile(new URL('../backend/migrations/'+file,import.meta.url),'utf8'))
    await db.exec('SET ROLE collection_app')
    app = createApp({query:(...args)=>db.query(...args)},{origin:'http://localhost:3001',allowLocalRegistration:true})
    await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve))
    const base=`http://127.0.0.1:${app.address().port}`
    const post=(path,data)=>fetch(base+path,{method:'POST',headers:{Origin:'http://localhost:3001','Content-Type':'application/json'},body:JSON.stringify(data)})
    const inbox=() => new Promise((resolve,reject) => {
      get(base+'/auth/local-inbox',{headers:{Host:'localhost:3001','X-Local-Lab':'1'}},res=>{
        let body=''; res.on('data',chunk=>{body+=chunk}); res.on('end',()=>{
          try { assert.equal(res.statusCode,200); resolve(JSON.parse(body).messages) } catch(error) {reject(error)}
        })
      }).on('error',reject)
    })
    const tokenOf=mail=>new URLSearchParams(new URL(mail.link).hash.slice(1)).get(mail.purpose)
    const user={email:'recovery@example.test',username:'recovery',display_name:'Test',password:'Password9',password_confirmation:'Password9'}
    const registered=await post('/auth/register',user)
    assert.equal(registered.status,201); assert.equal(registered.headers.get('set-cookie'),null)
    assert.equal((await registered.json()).verification_required,true)
    assert.equal((await post('/auth/login',user)).status,401)
    assert.equal((await fetch(base+'/auth/local-inbox')).status,403)
    let messages=await inbox()
    const first=tokenOf(messages[0])
    assert.equal((await post('/auth/request-verification',{email:user.email})).status,200)
    messages=await inbox()
    const second=tokenOf(messages[0])
    assert.notEqual(first,second)
    assert.equal((await post('/auth/verify-email',{token:first})).status,400)
    assert.equal((await post('/auth/verify-email',{token:second})).status,200)
    assert.equal((await post('/auth/verify-email',{token:second})).status,400)
    const login=await post('/auth/login',user)
    assert.equal(login.status,200)
    const cookie=login.headers.get('set-cookie').split(';')[0]
    const session=()=>fetch(base+'/auth/session',{headers:{Cookie:cookie}})
    assert.equal((await session()).status,200)
    const absent=await post('/auth/forgot-password',{email:'missing@example.test'})
    const present=await post('/auth/forgot-password',{email:user.email})
    assert.deepEqual(await absent.json(),await present.json())
    const reset=tokenOf((await inbox())[0])
    const next={password:'NewPassword9',password_confirmation:'NewPassword9',token:reset}
    assert.equal((await post('/auth/verify-email',{token:reset})).status,400)
    assert.equal((await post('/auth/reset-password',{...next,password_confirmation:'different'})).status,400)
    assert.equal((await post('/auth/reset-password',next)).status,200)
    assert.equal((await session()).status,401)
    assert.equal((await post('/auth/reset-password',next)).status,400)
    assert.equal((await post('/auth/login',user)).status,401)
    assert.equal((await post('/auth/login',{...user,password:next.password})).status,200)
    await assert.rejects(db.query('SELECT * FROM accounts.action_tokens'),/permission denied/)
    await post('/auth/forgot-password',{email:user.email})
    const expired=tokenOf((await inbox())[0])
    await db.exec('RESET ROLE')
    const stored=(await db.query('SELECT token_hash FROM accounts.action_tokens')).rows[0].token_hash
    assert.equal(stored,createHash('sha256').update(expired).digest('hex'))
    await db.exec("UPDATE accounts.action_tokens SET expires_at=now()-interval '1 second'; SET ROLE collection_app")
    assert.equal((await post('/auth/reset-password',{...next,token:expired})).status,400)
    await post('/auth/forgot-password',{email:user.email})
    const disabled=tokenOf((await inbox())[0])
    await db.exec('RESET ROLE; UPDATE accounts.users SET disabled_at=now(); SET ROLE collection_app')
    assert.equal((await post('/auth/reset-password',{...next,token:disabled})).status,400)
    assert.equal((await post('/auth/login',{...user,password:next.password})).status,401)
    assert.throws(()=>createApp({}, {origin:'https://example.com',allowLocalRegistration:true}),/local-only/)
  } finally { if(app) await new Promise(resolve=>app.close(resolve)); await db.close() }
})
