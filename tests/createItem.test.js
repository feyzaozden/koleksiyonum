import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createVerifiedItemHandler } from '../server/createItem.js'

const env = {VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_ANON_KEY:'public',TMDB_READ_ACCESS_TOKEN:'tmdb-secret',SUPABASE_SERVICE_ROLE_KEY:'service-secret'}
async function call(handler,body,authorization='Bearer user-token') {
  const res={statusCode:0,setHeader(){},end(text){this.body=JSON.parse(text)}}
  await handler({method:'POST',headers:{authorization},body},res)
  return res
}
test('verified creation binds ownership to session and metadata to TMDB, not caller',async()=>{
  let saved
  const handler=createVerifiedItemHandler({env,fetchImpl:async(url,options)=>{
    if(String(url).includes('/auth/v1/user'))return Response.json({id:'real-user'})
    if(String(url).includes('api.themoviedb.org'))return Response.json({id:42,title:'Real movie',release_date:'2010-01-01',credits:{crew:[{job:'Director',name:'Director'}]}})
    saved=JSON.parse(options.body)
    assert.equal(options.headers.apikey,'service-secret')
    return Response.json([{id:1,...saved}])
  }})
  const result=await call(handler,{category:'film',source_id:42,user_id:'someone-else',title:'Fake',creator:'Fake',year:'2099',added_at:'2000-01-01',note:'My note',rating:8})
  assert.equal(result.statusCode,201)
  assert.equal(saved.user_id,'real-user')
  assert.equal(saved.title,'Real movie')
  assert.equal(saved.creator,'Director')
  assert.equal(saved.year,'2010')
  assert.equal(saved.added_at,undefined)
  assert.equal(saved.source,'tmdb')
  assert.equal(saved.note,'My note')
  assert.equal(saved.rating,8)
  assert.ok(!JSON.stringify(result.body).includes('service-secret'))
})
test('verified endpoint rejects missing auth, bad IDs, absent credentials and missing catalog entries',async()=>{
  const handler=createVerifiedItemHandler({env,fetchImpl:async(url)=>String(url).includes('/auth/v1/user')?Response.json({id:'user'}):Response.json({}, {status:404})})
  assert.equal((await call(handler,{category:'film',source_id:1},'')).statusCode,401)
  assert.equal((await call(handler,{category:'film',source_id:'../1'})).statusCode,400)
  assert.equal((await call(handler,{category:'kitap',source_id:1})).statusCode,400)
  assert.equal((await call(handler,{category:'film',source_id:1})).statusCode,404)
  assert.equal((await call(createVerifiedItemHandler({env:{}}),{category:'film',source_id:1})).statusCode,503)
})
