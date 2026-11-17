import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createResendMail } from '../backend/src/resend-mail.js'
import { createApp } from '../backend/src/app.js'

const config={origin:'https://test.example.com',apiKey:'re_test_key',from:'notify@example.com',recipients:'owner@example.test'}
test('Resend retries preserve idempotency and tokens; disallowed recipients and provider errors are bounded',async()=>{
  const calls=[]; let queries=0
  const pool={query:async()=>{queries++;return {rows:[{created:true}]}}}
  const mail=createResendMail(pool,{...config,sleep:async()=>{},fetchImpl:async(url,options)=>{
    calls.push({url,...options});return new Response('{}',{status:calls.length<3?503:200})
  }})
  await mail.send('other@example.test','verify');assert.equal(queries,0)
  await mail.send('owner@example.test','verify')
  assert.equal(calls.length,3);assert.equal(queries,1)
  assert.equal(calls[0].body,calls[2].body)
  assert.equal(calls[0].headers['Idempotency-Key'],calls[2].headers['Idempotency-Key'])
  assert.match(JSON.parse(calls[0].body).text,/https:\/\/test.example.com\/auth-test#verify=[a-f0-9]{64}/)
  assert.equal(calls[0].url,'https://api.resend.com/emails')
  let rejected=0
  const bad=createResendMail(pool,{...config,fetchImpl:async()=>{rejected++;return new Response('sensitive provider detail',{status:401})}})
  await assert.rejects(bad.send('owner@example.test','reset'),error=>error.status===503 && !error.message.includes('sensitive'))
  assert.equal(rejected,1)
  assert.throws(()=>createResendMail(pool,{...config,recipients:''}),/RECIPIENTS/)
  assert.throws(()=>createResendMail(pool,{...config,origin:'http://example.com'}),/HTTPS/)
})

test('real-email test flow gates registrations, hides inbox and replaces preregistration password on verification',async()=>{
  const db=new PGlite();let app
  try {
    await db.exec('CREATE ROLE collection_app')
    for(const file of ['001_core.sql','002_auth.sql','003_auth_links.sql','004_verified_password.sql']) await db.exec(await readFile(new URL('../backend/migrations/'+file,import.meta.url),'utf8'))
    await db.exec('SET ROLE collection_app')
    const pool={query:(...args)=>db.query(...args)},messages=[]
    const mail=createResendMail(pool,{...config,fetchImpl:async(url,options)=>{messages.push(JSON.parse(options.body));return new Response('{}',{status:200})}})
    app=createApp(pool,{origin:config.origin,realMail:mail})
    await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve))
    const base=`http://127.0.0.1:${app.address().port}`
    const post=(path,body,origin=config.origin)=>fetch(base+'/auth/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)})
    const data={email:'owner@example.test',username:'mail_owner',display_name:'Owner',password:'OriginalPassword9',password_confirmation:'OriginalPassword9'}
    assert.equal((await fetch(base+'/auth/local-inbox')).status,404)
    assert.equal((await fetch(base+'/auth-lab')).status,404)
    assert.equal((await fetch(base+'/auth-test')).status,200)
    assert.equal((await post('register',data,'https://evil.test')).status,403)
    assert.equal((await post('register',{...data,email:'outside@example.test'})).status,403)
    assert.equal(messages.length,0)
    assert.equal((await post('register',data)).status,201)
    assert.equal((await post('login',data)).status,401)
    const token=messages[0].text.match(/#verify=([a-f0-9]{64})/)[1]
    assert.equal((await post('verify-email',{token})).status,400)
    const password={password:'OwnerChosenPassword8',password_confirmation:'OwnerChosenPassword8'}
    assert.equal((await post('verify-email',{token,...password})).status,200)
    assert.equal((await post('verify-email',{token,...password})).status,400)
    assert.equal((await post('login',data)).status,401)
    const login=await post('login',{...data,...password})
    assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/Secure/)
    const cookie=login.headers.get('set-cookie').split(';')[0]
    await post('forgot-password',{email:data.email})
    const reset=messages[1].text.match(/#reset=([a-f0-9]{64})/)[1]
    assert.equal((await post('reset-password',{token:reset,password:'ResetPassword7',password_confirmation:'ResetPassword7'})).status,200)
    assert.equal((await fetch(base+'/auth/session',{headers:{Cookie:cookie}})).status,401)
    await assert.rejects(db.query('SELECT * FROM accounts.action_tokens'),/permission denied/)
  } finally {if(app)await new Promise(resolve=>app.close(resolve));await db.close()}
})
