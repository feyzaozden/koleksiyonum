import { createHash } from 'node:crypto'

const fail=(status,message)=>Object.assign(new Error(message),{status})
const fields=new Set(['category','title','creator','year','status','note','start_date','end_date','rating','emoji'])
async function readBody(req) {
  if(req.headers['content-type']?.split(';')[0].trim()!=='application/json') throw fail(415,'JSON gerekli.')
  const chunks=[];let size=0
  for await(const chunk of req){size+=chunk.length;if(size>16384)throw fail(413,'İstek çok büyük.');chunks.push(chunk)}
  try {const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||Array.isArray(value)||typeof value!=='object')throw new Error();return value}
  catch{throw fail(400,'Geçersiz JSON.')}
}
function validate(data) {
  for(const [key,value] of Object.entries(data)) {
    if(!fields.has(key))throw fail(400,'Bu alan değiştirilemez: '+key)
    if(value!=null && key!=='rating' && typeof value!=='string')throw fail(400,'Geçersiz alan: '+key)
  }
  if(data.rating!=null && (!Number.isInteger(data.rating)||data.rating<1||data.rating>10))throw fail(400,'Puan 1–10 arasında tam sayı olmalı.')
  for(const key of ['start_date','end_date'])if(data[key]!=null) {
    const date=data[key]
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<'0001-01-01'||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw fail(400,'Geçerli bir tarih gir.')
  }
}
export function createItems(pool,{origin}) {
  const name=new URL(origin).protocol==='https:'?'__Host-koleksiyonum_session':'koleksiyonum_dev_session'
  return async(req,res,path)=>{
    const reply=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data))}
    try {
      const match=/^\/api\/collection(?:\/([1-9]\d{0,18}))?$/.exec(path)
      if(!match)return reply(404,{error:'İçerik bulunamadı.'})
      const id=match[1]||null
      if(id && BigInt(id)>9223372036854775807n)throw fail(400,'Geçersiz içerik numarası.')
      const methods=id?['PATCH','DELETE']:['GET','POST']
      if(!methods.includes(req.method)){res.setHeader('Allow',methods.join(', '));throw fail(405,'Bu yöntem desteklenmiyor.')}
      if(req.method!=='GET'&&(req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site'))throw fail(403,'İstek kaynağına izin verilmiyor.')
      const cookies=(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'='))
      const token=cookies.length===1?cookies[0].slice(name.length+1):''
      if(!/^[a-f0-9]{64}$/.test(token))throw fail(401,'Lütfen giriş yap.')
      const hash=createHash('sha256').update(token).digest('hex')
      if(req.method==='GET') {
        const params=new URL(req.url,origin).searchParams
        if([...params.keys()].some(key=>!['category','limit','offset'].includes(key)))throw fail(400,'Geçersiz listeleme parametresi.')
        const limit=params.get('limit')||'20', offset=params.get('offset')||'0'
        if(!/^\d{1,2}$/.test(limit)||!/^\d{1,6}$/.test(offset))throw fail(400,'Geçersiz sayfa.')
        const result=await pool.query('SELECT collection.list_own_items($1,$2,$3,$4) AS result',[hash,params.get('category'),Number(limit),Number(offset)])
        return reply(200,result.rows[0].result)
      }
      const body=await readBody(req)
      const {revision,...data}=body
      if(id&&(!Number.isInteger(revision)||revision<1||revision>2147483647))throw fail(400,'Güncel kayıt sürümü gerekli.')
      if(!id&&revision!==undefined)throw fail(400,'Yeni kayıtta sürüm gönderme.')
      if(req.method==='DELETE') {
        if(Object.keys(data).length)throw fail(400,'Geçersiz silme isteği.')
        await pool.query('SELECT collection.delete_own_item($1,$2,$3)',[hash,id,revision])
        return reply(200,{ok:true})
      }
      validate(data)
      const result=await pool.query('SELECT collection.write_own_item($1,$2,$3,$4) AS item',[hash,id,revision||null,JSON.stringify(data)])
      return reply(id?200:201,{item:result.rows[0].item})
    } catch(error) {
      if(error.status)return reply(error.status,{error:error.message})
      const codes={P0400:400,P0401:401,P0404:404,P0409:409,P0429:429}
      if(codes[error.code])return reply(codes[error.code],{error:error.message})
      if(error.code==='23505')return reply(409,{error:'Bu içerik zaten koleksiyonunda.'})
      if(error.code?.startsWith('22')||['23502','23514'].includes(error.code))return reply(400,{error:'İçerik bilgilerini kontrol et.'})
      return reply(503,{error:'İşlem tamamlanamadı. Biraz sonra tekrar dene.'})
    }
  }
}
