import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { createApp } from '../backend/src/app.js'
import { hashPassword, verifyPassword } from '../backend/src/password.js'

test('password change verifies current secret, rotates sessions, revokes links and limits attempts', async () => {
  const db = new PGlite(); let app
  const digest = value => createHash('sha256').update(value).digest('hex')
  try {
    await db.exec('CREATE ROLE collection_app')
    const dir = new URL('../backend/migrations/', import.meta.url)
    for (const file of (await readdir(dir)).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,dir),'utf8'))
    const oldHash = await hashPassword('OldPassword9'), original = 'a'.repeat(64), otherDevice = 'b'.repeat(64)
    const actor = (await db.query("INSERT INTO accounts.users(email,password_hash,email_verified_at) VALUES('change@example.test',$1,now()) RETURNING id",[oldHash])).rows[0].id
    await db.query("INSERT INTO collection.profiles(id,username,display_name) VALUES($1,'change_user','Test')",[actor])
    for (const token of [original,otherDevice]) await db.query('INSERT INTO accounts.sessions(token_hash,user_id) VALUES($1,$2)',[digest(token),actor])
    await db.query("INSERT INTO accounts.action_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,'reset',now()+interval '1 hour')",[digest('reset'),actor])
    await db.exec('SET ROLE collection_app')
    app = createApp({query:(...args)=>db.query(...args)},{origin:'https://test.example'})
    await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve))
    const base = `http://127.0.0.1:${app.address().port}`
    const cookie = token => `__Host-koleksiyonum_session=${token}`
    const body = {current_password:'OldPassword9',password:'NewPassword8',password_confirmation:'NewPassword8'}
    const change = (patch={},token=original,origin='https://test.example')=>fetch(base+'/api/collection/password',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Cookie:cookie(token)}:{})},body:JSON.stringify({...body,...patch})})
    const session = token => fetch(base+'/auth/session',{headers:{Cookie:cookie(token)}})
    assert.equal((await change({},'')).status,401)
    assert.equal((await change({},original,'https://evil.example')).status,403)
    assert.equal((await change({current_password:'WrongPassword9'})).status,400)
    assert.equal((await change({password_confirmation:'Different9'})).status,400)
    assert.equal((await change({password:'weak',password_confirmation:'weak'})).status,400)
    assert.equal((await change({user_id:actor})).status,400)
    assert.equal((await session(otherDevice)).status,200)
    const result = await change()
    assert.equal(result.status,200)
    assert.deepEqual(await result.json(),{ok:true})
    const header = result.headers.get('set-cookie')
    assert.match(header,/HttpOnly/); assert.match(header,/Secure/); assert.match(header,/SameSite=Lax/)
    const next = header.split(';')[0].split('=')[1]
    assert.notEqual(next,original)
    assert.equal((await session(original)).status,401)
    assert.equal((await session(otherDevice)).status,401)
    assert.equal((await session(next)).status,200)
    // A password verification completed before a concurrent reset/change cannot overwrite it.
    assert.equal((await db.query('SELECT accounts.change_password($1,$2,$3,$4) AS changed',[digest(next),oldHash,oldHash,digest('stale')])).rows[0].changed,false)
    await db.exec('RESET ROLE')
    const saved = (await db.query('SELECT password_hash FROM accounts.users WHERE id=$1',[actor])).rows[0].password_hash
    assert.equal(await verifyPassword('NewPassword8',saved),true)
    assert.equal(await verifyPassword('OldPassword9',saved),false)
    assert.equal((await db.query('SELECT count(*)::integer AS n FROM accounts.sessions WHERE user_id=$1',[actor])).rows[0].n,1)
    assert.equal((await db.query('SELECT count(*)::integer AS n FROM accounts.action_tokens WHERE user_id=$1',[actor])).rows[0].n,0)
    await db.query('UPDATE accounts.auth_limits SET attempts=10 WHERE bucket=$1',[digest('change-password:'+actor)])
    await db.exec('SET ROLE collection_app')
    assert.equal((await change({current_password:'NewPassword8'},next)).status,429)
    await assert.rejects(db.query('SELECT password_hash FROM accounts.users'),/permission denied/)
  } finally { if (app) await new Promise(resolve=>app.close(resolve)); await db.close() }
})
