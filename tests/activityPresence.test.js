import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startActivityPresence } from '../src/utils/activityPresence.js'

test('presence reports visible interaction, throttles calls and stops on cleanup', async () => {
  let time=0, sent=0, tick
  const handlers = new Map()
  const doc = { hidden:false, addEventListener:(k,v)=>handlers.set(k,v), removeEventListener:k=>handlers.delete(k) }
  const win = { addEventListener:(k,v)=>handlers.set(k,v), removeEventListener:k=>handlers.delete(k), setInterval:fn=>{tick=fn;return 1}, clearInterval:()=>{} }
  const stop=startActivityPresence({ doc,win,now:()=>time,send:async()=>{sent++;return {}} })
  await Promise.resolve()
  assert.equal(sent,1)
  time=60000; await tick(); assert.equal(sent,1,'idle open tab is not activity')
  handlers.get('keydown')({isTrusted:true})
  await tick(); assert.equal(sent,2)
  handlers.get('scroll')({isTrusted:true})
  await tick(); assert.equal(sent,2,'one minute throttle')
  time=120000; doc.hidden=true
  await tick(); assert.equal(sent,2,'hidden tab cannot send')
  doc.hidden=false; handlers.get('visibilitychange')()
  await Promise.resolve(); assert.equal(sent,3)
  stop(); time=180000; await tick()
  assert.equal(sent,3)
  assert.equal(handlers.size,0)
})
