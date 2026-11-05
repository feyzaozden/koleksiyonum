import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('comments enforce friendship, anonymity, limits, reactions, deletion and notifications', async () => {
  const db = new PGlite()
  const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
  const as = async (n) => {
    await db.exec('reset role; set role authenticated;')
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id(n)])
  }
  try {
    await db.exec(`
      create role authenticated; create role anon;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
    `)
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/migrations/20260925_friendships.sql', import.meta.url), 'utf8'))
    await db.exec(`
      grant select, insert, update, delete on public.items, public.profiles to authenticated;
      grant usage, select on all sequences in schema public to authenticated;
    `)
    for (let n = 1; n <= 4; n++) await db.query('insert into auth.users(id,email) values($1,$2)', [id(n), `user${n}@example.test`])
    await db.query("insert into public.items(user_id,category,title) values($1,'film','Existing film'),($2,'kitap','Private book')", [id(1), id(4)])
    await db.query("insert into public.friendships(requester_id,recipient_id,status) values($1,$2,'accepted'),($1,$3,'accepted'),($1,$4,'pending')", [id(1), id(2), id(3), id(4)])
    const migration = await readFile(new URL('../supabase/migrations/20261013_item_reactions.sql', import.meta.url), 'utf8')
    await db.exec(migration)

    await db.exec("alter table public.profiles add column username text; alter table public.profiles add column avatar_path text; update public.profiles set username='user-' || id::text")
    for (const file of ['20261018_profile_privacy.sql','20261018_reaction_notifications.sql','20261102_friend_notifications.sql','20261105_comments.sql']) {
      await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
    }
    const commentSql=await readFile(new URL('../supabase/migrations/20261105_comments.sql',import.meta.url),'utf8')
    await db.exec(commentSql)
    const countsSql=await readFile(new URL('../supabase/migrations/20261105_comments_counts.sql',import.meta.url),'utf8')
    await db.exec(countsSql)
    await db.exec(countsSql)
    const counts=async()=>(await db.query('select * from public.get_item_comment_counts(array[1::bigint,2::bigint])')).rows
    const add=async(text,anon=false,parent=null,item=1)=>(await db.query('select public.add_item_comment($1,$2,$3,$4) as id',[item,text,anon,parent])).rows[0].id
    const list=async(item=1,after=0,focus=null)=>(await db.query('select public.get_item_comments($1,$2,$3) as data',[item,after,focus])).rows[0].data
    const inbox=async()=>(await db.query('select public.get_reaction_notifications() as data')).rows[0].data
    const react=(comment,value)=>db.query('select public.set_comment_reaction($1,$2)',[comment,value])
    const remove=comment=>db.query('select public.delete_item_comment($1)',[comment])
    await as(1)
    await db.query('update public.profiles set is_public=true where id=$1',[id(1)])
    await as(4)
    await assert.rejects(list(),/arkadaş/)
    assert.deepEqual((await counts()).map(r=>Number(r.item_id)),[2])
    await assert.rejects(add('stranger'),/arkadaş/)
    await as(2)
    await assert.rejects(add('   '),/Yorumunu/)
    await assert.rejects(add('\u00a0\u202f'),/Yorumunu/)
    const anonymous=await add('Anonymous root',true)
    const named=await add('Named root')
    await assert.rejects(add('Cross item',false,anonymous,2))
    await assert.rejects(react(anonymous,1),/Kendi/)
    await as(1)
    let result=await list()
    const hidden=result.entries.find(c=>c.id===anonymous)
    for (const field of ['profile_id','username','avatar_path','avatar_emoji']) assert.equal(hidden[field],null)
    assert.equal(hidden.author_id,undefined)
    assert.equal(hidden.own,false)
    assert.equal(hidden.can_delete,true)
    assert.equal(result.entries.find(c=>c.id===named).profile_id,id(2))
    let alerts=(await inbox()).entries
    assert.equal(alerts.filter(n=>n.kind==='comment').length,2,'multiple comments by same author notify independently')
    assert.equal(alerts.find(n=>n.comment_id===anonymous).profile_id,null)
    assert.equal(alerts.find(n=>n.comment_id===anonymous).username,null)
    const reply=await add('Owner reply',true,anonymous)
    assert.equal(Number((await counts())[0].comment_count),3,'counts include replies and anonymous comments')
    await assert.rejects(add('Nested reply',false,reply),/ana yoruma/)
    await react(anonymous,1)
    await react(anonymous,1)
    assert.equal((await list()).entries.find(c=>c.id===anonymous).likes,1)
    await react(anonymous,-1)
    assert.equal((await list()).entries.find(c=>c.id===anonymous).dislikes,1)
    await as(2)
    const replyAlert=(await inbox()).entries.find(n=>n.kind==='reply')
    assert.equal(replyAlert.comment_id,reply)
    assert.equal(replyAlert.profile_id,null)
    await as(3)
    await react(anonymous,1)
    result=await list()
    assert.equal(result.entries.find(c=>c.id===anonymous).likes,1)
    assert.equal(result.entries.find(c=>c.id===anonymous).dislikes,1)
    assert.equal(result.entries.find(c=>c.id===anonymous).voter_id,undefined)
    await assert.rejects(remove(anonymous),/yetkin/)
    for(const table of ['item_comments','comment_reactions']) {
      await assert.rejects(db.query('select * from collection_private.'+table),/permission denied/)
      await assert.rejects(db.query('delete from collection_private.'+table),/permission denied/)
    }
    await as(1)
    await remove(anonymous)
    assert.equal(Number((await counts())[0].comment_count),2,'deleted comments excluded but replies retained')
    result=await list()
    assert.equal(result.entries.find(c=>c.id===anonymous),undefined)
    assert.equal(result.entries.find(c=>c.id===reply).parent_preview,null)
    assert.ok(!(await list(1,0,anonymous)).entries.some(c=>c.id===anonymous))
    assert.equal(result.entries.find(c=>c.id===reply).body,'Owner reply')
    await assert.rejects(react(anonymous,1),/mevcut değil/)
    await assert.rejects(add('Reply to deleted',false,anonymous))
    const friendship=(await db.query('select id from public.friendships where recipient_id=$1',[id(2)])).rows[0].id
    await db.query('select public.remove_friendship($1)',[friendship])
    await as(2)
    await assert.rejects(list(),/arkadaş/)
    await assert.rejects(add('After unfriend'),/arkadaş/)
    await assert.rejects(react(reply,1),/arkadaş/)
    const own=(await db.query('select public.get_my_comments() as data')).rows[0].data
    assert.equal(own.length,1)
    assert.equal(own[0].id,named)
    assert.equal(own[0].can_open,false)
    await remove(named)
    assert.equal((await db.query('select public.get_my_comments() as data')).rows[0].data.length,0)
    await as(1)
    const longComment=await add('uzun '.repeat(300))
    assert.equal((await list()).entries.find(c=>c.id===longComment).body,'uzun '.repeat(300).trim())
    await remove(longComment)
    await db.exec('reset role')
    await db.exec(`create table collection_private.activity_history(
      id bigint generated always as identity primary key, actor_id uuid, subject_id uuid, related_user_id uuid,
      action text,record_id text,origin text,details jsonb
    )`)
    await as(1)
    for(let n=0;n<51;n++) await add('Page '+n)
    const first=await list()
    assert.equal(first.entries.length,50)
    assert.equal(first.has_more,true)
    const next=await list(1,first.entries.at(-1).id)
    assert.equal(next.has_more,false)
    assert.ok(next.entries.every(n=>n.id>first.entries.at(-1).id))
    assert.ok((await list(1,0,next.entries.at(-1).id)).entries.some(n=>n.id===next.entries.at(-1).id))
    await db.exec('reset role')
    const audit=(await db.query('select * from collection_private.activity_history')).rows
    assert.ok(audit.some(row=>row.action==='comment_created'))
    assert.ok(!JSON.stringify(audit).includes('Page 0'),'audit must not copy comment bodies')
    await db.exec(commentSql)
    await as(1)
    await db.query('delete from public.items where id=1')
    await db.exec('reset role')
    assert.equal((await db.query('select * from collection_private.item_comments')).rows.length,0)
    assert.equal((await db.query('select * from collection_private.comment_reactions')).rows.length,0)
    await db.exec("set role anon; select set_config('request.jwt.claim.sub','',false)")
    await assert.rejects(list(),/permission denied/)
    await assert.rejects(add('Anonymous caller'),/permission denied/)
    await assert.rejects(db.query('select public.get_my_comments()'),/permission denied/)
  } finally { await db.close() }
})


