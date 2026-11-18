const form=document.getElementById('item-form'), message=document.getElementById('message')
let editing=null,offset=0,total=0,busy=false
async function request(url,method='GET',body) {
  const response=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})})
  const data=await response.json()
  if(!response.ok)throw new Error(data.error||'İşlem tamamlanamadı.')
  return data
}
function buttons() {
  document.querySelectorAll('button').forEach(b=>{b.disabled=busy})
  document.getElementById('previous').disabled=busy||offset===0
  document.getElementById('next').disabled=busy||offset+20>=total
}
async function run(action) {
  if(busy)return
  busy=true;buttons();message.textContent=''
  try{await action()}catch(error){message.textContent=error.message}finally{busy=false;buttons()}
}
function reset(){editing=null;form.reset();document.getElementById('form-title').textContent='Yeni içerik';music()}
function music(){document.getElementById('status-label').hidden=form.elements.category.value==='muzik'}
async function load(){
  const params=new URLSearchParams({limit:'20',offset:String(offset)})
  const category=document.getElementById('category-filter').value
  if(category)params.set('category',category)
  const data=await request('/api/collection?'+params)
  total=data.total
  if(offset>0&&offset>=total){offset=Math.max(0,offset-20);return load()}
  document.getElementById('count').textContent=`${total} kayıt`
  const list=document.getElementById('items');list.replaceChildren()
  for(const item of data.items){
    const card=document.createElement('article'),heading=document.createElement('h3'),description=document.createElement('p')
    heading.textContent=item.title
    description.textContent=[item.category,item.creator,item.year,item.category==='muzik'?null:item.status,item.start_date,item.end_date,item.rating?`${item.rating}/10`:null,item.note].filter(Boolean).join(' · ')
    const edit=document.createElement('button');edit.textContent='Düzenle'
    edit.addEventListener('click',()=>{editing=item;for(const field of ['category','title','creator','year','status','start_date','end_date','rating','note'])form.elements[field].value=item[field]??'';music();document.getElementById('form-title').textContent='İçeriği düzenle';form.scrollIntoView({behavior:'smooth'})})
    const remove=document.createElement('button');remove.textContent='Sil'
    remove.addEventListener('click',()=>run(async()=>{if(!confirm(`“${item.title}” silinsin mi?`))return;await request('/api/collection/'+item.id,'DELETE',{revision:item.revision});if(editing?.id===item.id)reset();await load();message.textContent='İçerik silindi.'}))
    card.append(heading,description,edit,remove);list.append(card)
  }
  buttons()
}
form.addEventListener('submit',event=>{event.preventDefault();run(async()=>{
  const data=Object.fromEntries(new FormData(form))
  for(const key of ['creator','year','start_date','end_date','note'])if(!data[key])data[key]=null
  data.rating=data.rating?Number(data.rating):null
  if(editing)data.revision=editing.revision
  await request('/api/collection'+(editing?'/'+editing.id:''),editing?'PATCH':'POST',data)
  reset();await load();message.textContent='Kaydedildi.'
})})
form.elements.category.addEventListener('change',music)
document.getElementById('cancel').addEventListener('click',reset)
document.getElementById('refresh').addEventListener('click',()=>run(load))
document.getElementById('category-filter').addEventListener('change',()=>run(async()=>{offset=0;await load()}))
document.getElementById('previous').addEventListener('click',()=>run(async()=>{offset=Math.max(0,offset-20);await load()}))
document.getElementById('next').addEventListener('click',()=>run(async()=>{offset+=20;await load()}))
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
form.elements.start_date.max=today;form.elements.end_date.max=today
run(load)
