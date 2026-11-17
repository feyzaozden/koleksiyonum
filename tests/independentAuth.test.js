import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createApp } from '../backend/src/app.js'
import { hashPassword, verifyPassword } from '../backend/src/password.js'

test('independent auth registers, validates, rotates and revokes private sessions', async () => {
  const db = new PGlite()
  let app
  try {
    await db.exec('CREATE ROLE collection_app')
    for (const file of ['001_core.sql','002_auth.sql']) await db.exec(await readFile(new URL('../backend/migrations/'+file,import.meta.url),'utf8'))
    await db.exec('SET ROLE collection_app')
    const pool = { query: async (...args) => { const result = await db.query(...args); return { ...result, rowCount:result.rows.length } } }
    app = createApp(pool,{origin:'http://localhost:3001',allowLocalRegistration:true,requireEmailVerification:false})
    await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve))
    const base=`http://127.0.0.1:${app.address().port}`
    const data={email:'Test@example.test',username:'Test_user',display_name:'Test',password:'ExamplePassword9',password_confirmation:'ExamplePassword9'}
    const post=(path,body,token='',origin='http://localhost:3001')=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(token?{Cookie:token}:{})},body:JSON.stringify(body)})
    assert.equal((await post('/auth/register',data,'','https://untrusted.example')).status,403)
    assert.equal((await post('/auth/register',{...data,password_confirmation:'different'})).status,400)
    const created=await post('/auth/register',data)
    assert.equal(created.status,201)
    const header=created.headers.get('set-cookie')
    assert.match(header,/HttpOnly/);assert.match(header,/SameSite=Lax/)
    const first=header.split(';')[0]
    const session=await fetch(base+'/auth/session',{headers:{Cookie:first}})
    const user=(await session.json()).user
    assert.equal(user.username,'test_user');assert.equal(user.email,'test@example.test')
    assert.equal(user.password_hash,undefined)
    assert.equal((await post('/auth/login',{...data,password:'WrongPassword9'})).status,401)
    const logged=await post('/auth/login',data,first)
    assert.equal(logged.status,200)
    const second=logged.headers.get('set-cookie').split(';')[0]
    assert.notEqual(first,second)
    assert.equal((await fetch(base+'/auth/session',{headers:{Cookie:first}})).status,401)
    assert.equal((await post('/auth/logout',{},second)).status,200)
    assert.equal((await fetch(base+'/auth/session',{headers:{Cookie:second}})).status,401)
    await assert.rejects(db.query('SELECT * FROM accounts.users'),/permission denied/)
    await db.exec('RESET ROLE')
    const saved=(await db.query('SELECT password_hash FROM accounts.users')).rows[0].password_hash
    assert.notEqual(saved,data.password);assert.equal(await verifyPassword(data.password,saved),true)
    const another=await hashPassword(data.password);assert.notEqual(another,saved)
    await db.exec('SET ROLE collection_app')
    for(let i=0;i<10;i++) assert.equal((await db.query("SELECT accounts.consume_auth_limit('rate-test',10) AS allowed")).rows[0].allowed,true)
    assert.equal((await db.query("SELECT accounts.consume_auth_limit('rate-test',10) AS allowed")).rows[0].allowed,false)
  } finally { if(app) await new Promise(resolve=>app.close(resolve));await db.close() }
})
