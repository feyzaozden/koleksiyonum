import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { createApp } from '../backend/src/app.js'

test('manual collection API protects ownership, dates, duplicates, revisions and daily quota',async()=>{
  const db=new PGlite();let app
  try{
    await db.exec('CREATE ROLE collection_app')
    for(const file of ['001_core.sql','002_auth.sql','003_auth_links.sql','004_verified_password.sql','005_collection_crud.sql','006_progress_catalog.sql'])await db.exec(await readFile(new URL('../backend/migrations/'+file,import.meta.url),'utf8'))
    const tokens=['a'.repeat(64),'b'.repeat(64)],hashes=tokens.map(t=>createHash('sha256').update(t).digest('hex')),ids=[]
    for(let i=0;i<2;i++){
      const id=(await db.query('INSERT INTO accounts.users(email,email_verified_at) VALUES($1,now()) RETURNING id',[`item${i}@example.test`])).rows[0].id;ids.push(id)
      await db.query('INSERT INTO accounts.sessions(token_hash,user_id) VALUES($1,$2)',[hashes[i],id])
    }
    await db.exec('SET ROLE collection_app')
    app=createApp({query:(...args)=>db.query(...args)},{origin:'https://test.example.com'})
    await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve))
    const base=`http://127.0.0.1:${app.address().port}/api/collection`
    const call=(method='GET',body,suffix='',user=0,origin='https://test.example.com')=>fetch(base+suffix,{method,headers:{Cookie:`__Host-koleksiyonum_session=${tokens[user]}`,Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
    assert.equal((await fetch(base)).status,401)
    assert.equal((await call('POST',{category:'kitap',title:'Book'},'',0,'https://evil.test')).status,403)
    assert.equal((await call('POST',{category:'kitap',title:'Book',user_id:ids[1]})).status,400)
    assert.equal((await call('POST',{category:'film',title:'Book',source_id:123})).status,400)
    for(const invalid of [{start_date:'2099-01-01'},{end_date:'2099-01-01'},{start_date:'2020-01-02',end_date:'2020-01-01'},{start_date:'2023-02-29'},{year:'9999'},{rating:2.5}])assert.equal((await call('POST',{category:'kitap',title:'Bad',...invalid})).status,400)
    const first=await call('POST',{category:'kitap',title:' İSTANBUL ',creator:'Yazar',year:'2020'})
    assert.equal(first.status,201)
    let item=(await first.json()).item
    assert.equal(typeof item.id,'string');assert.equal(item.year,'2020')
    assert.equal((await call('POST',{category:'kitap',title:'istanbul',creator:' yazar ',year:'2020'})).status,409)
    assert.equal((await call('PATCH',{title:'Stolen',revision:1},'/'+item.id,1)).status,404)
    assert.equal((await call('DELETE',{revision:1},'/'+item.id,1)).status,404)
    assert.equal((await (await call('GET',null,'',1)).json()).total,0)
    const changed=await call('PATCH',{note:'Changed',revision:1},'/'+item.id);assert.equal(changed.status,200);item=(await changed.json()).item
    assert.equal(item.revision,2)
    assert.equal((await call('PATCH',{note:'stale',revision:1},'/'+item.id)).status,409)
    assert.equal((await call('DELETE',{revision:1},'/'+item.id)).status,409)
    await call('POST',{category:'film',title:'Dated',end_date:'2020-01-01'})
    assert.equal((await (await call()).json()).items[0].title,'Dated')
    assert.equal((await call('GET',null,'?limit=51')).status,400)
    assert.equal((await (await call('GET',null,'?category=film')).json()).total,1)
    await assert.rejects(db.query('SELECT * FROM collection.items'),/permission denied/)
    await db.exec('RESET ROLE')
    assert.equal((await db.query('SELECT used FROM collection.daily_item_usage WHERE user_id=$1',[ids[0]])).rows[0].used,2)
    await db.query('UPDATE collection.daily_item_usage SET used=99 WHERE user_id=$1',[ids[0]])
    await db.exec('SET ROLE collection_app')
    assert.equal((await call('POST',{category:'muzik',title:'Song',status:'bitti'})).status,201)
    assert.equal((await call('POST',{category:'kitap',title:'Over limit'})).status,429)
    assert.equal((await call('DELETE',{revision:2},'/'+item.id)).status,200)
    assert.equal((await call('POST',{category:'kitap',title:'Still over limit'})).status,429)
    assert.equal((await call('POST',{category:'kitap',title:'Other account'},'',1)).status,201)
    await db.exec('RESET ROLE')
    await db.query('UPDATE accounts.users SET disabled_at=now() WHERE id=$1',[ids[1]])
    await db.exec('SET ROLE collection_app')
    assert.equal((await call('GET',null,'',1)).status,401)
  }finally{if(app)await new Promise(resolve=>app.close(resolve));await db.close()}
})
