'use strict';
const $ = id => document.getElementById(id);
const tasks = {
  '换料': '只调整指定部位的面料外观、纹理、光泽和自然褶皱。',
  '换色': '仅按要求替换指定部位的色彩，真实呈现明暗与材质。',
  '改结构': '调整指定部件的形状、开口、位置或连接方式。清楚呈现实际可见的变化。',
  '拆款': '请以中文拆解这张原款图。按包型与比例、表面材质观感、提手肩带、外袋、袋口、五金和可见缝线逐项描述。注明看不清或待核实项，最后输出一段可复用的设计提示词。只输出文字。',
  '新款': '根据设计要求生成一个原创箱包概念。呈现完整的产品轮廓、提手和包底，采用干净背景的产品摄影风格。'
};
let db, project, inputSlot, archiveFolder, pairing = '';
const projects = new Map(), pictures = new Map(), urls = new Map();
function status(message, error=false) {
  $('status').textContent=message;
  $('status').classList.toggle('error',error);
}
function guard(fn) {
  return async function(event) {
    try { await fn(event); } catch(error) { status(error.message || String(error),true); }
  };
}
function requestResult(request) {
  return new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
function put(store, value) {
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete=resolve;
    tx.onabort=()=>reject(tx.error || new Error('浏览器保存失败，请导出需要保留的方案。'));
  });
}
function save() {
  project.updated=Date.now();
  return put('projects',project);
}
function blank() {
  return {id:crypto.randomUUID(),code:'',mode:'换料',original:null,reference:null,refRole:'',brief:'',base:'',analysis:'',versions:[],focus:null,picked:null,updated:Date.now()};
}
function currentVersion(){ return project.versions.find(v=>v.id===project.focus); }
function basePicture(){ return project.base || project.original; }
function baseTitle(){
  const i=project.versions.findIndex(v=>v.asset===project.base);
  return project.base && i>=0 ? '方案 '+String(i+1).padStart(2,'0') : '原款';
}
function sourceIds(){
  if (project.mode==='新款') return [project.reference].filter(Boolean);
  if (project.mode==='拆款') return [basePicture()].filter(Boolean);
  return [basePicture(),project.reference].filter(Boolean);
}
function compose(){
  const task=project.mode, lines=[tasks[task]];
  if(task==='新款' && project.reference) lines.push('图一是参考图。参考范围：'+(project.refRole.trim()||'造型气质与风格方向')+'。');
  if(task!=='新款' && task!=='拆款'){
    lines.push('图一是本轮底图（'+baseTitle()+'）。保持其整体比例、提手固定点、包底、拍摄视角、画面大小及未指定的细节。');
    if(project.reference) lines.push('图二是参考图，仅使用以下特征：'+(project.refRole.trim()||'本轮设计要求中指定的特征')+'。');
  }
  if(project.brief.trim()) lines.push('本轮要求：'+project.brief.trim());
  if(task!=='拆款') lines.push('请直接输出一张单款效果图，产品完整入画。');
  return lines.join('\n');
}
function validate(){
  if(project.mode!=='新款' && !basePicture()) throw new Error('请先添加原款图，或选择已有方案作为本轮底图。');
  if(project.mode!=='拆款' && !project.brief.trim()) throw new Error('请先写一句本轮设计要求。');
}
function snapshot(){
  return {prompt:compose(),mode:project.mode,base:project.mode==='新款'?null:basePicture(),original:project.original,
    ref:project.mode==='拆款'?null:project.reference,at:new Date().toISOString()};
}
function fillSelect(el, entries, selected){
  el.replaceChildren(...entries.map(([value,label])=>new Option(label,value)));
  el.value=selected;
}
function nameProject(){ return project.code.trim() || '未命名款式'; }
function renderProjects(){
  fillSelect($('projects'),Array.from(projects.values(),p=>[p.id,p.code.trim() || '未命名款式']),project.id);
}
function imageElement(id){
  const image=new Image();
  image.alt=pictures.get(id)?.name || '方案图片';
  const setSource = asset=>{
    if(!asset) return;
    if(!urls.has(id)) urls.set(id,URL.createObjectURL(asset.blob));
    image.src=urls.get(id);
  };
  if(pictures.has(id)) setSource(pictures.get(id));
  else requestResult(db.transaction('assets').objectStore('assets').get(id)).then(asset=>{
    if(asset){pictures.set(id,asset);setSource(asset);}
  }).catch(error=>status(error.message,true));
  return image;
}
function frame(el,id,empty){
  el.replaceChildren();
  if(id) el.append(imageElement(id)); else el.textContent=empty;
}
function renderAssets(){
  for(const [slot,clearButton] of [['original','clearOriginal'],['reference','clearRef']]){
    frame($(slot),project[slot],'＋ 拖入或选图');
    $(clearButton).hidden=!project[slot];
  }
}
function renderTask(){
  for(const button of $('modes').children) button.setAttribute('aria-pressed',String(button.textContent===project.mode));
  fillSelect($('base'),[['','原款图'],...project.versions.map((v,i)=>[v.asset,'方案 '+String(i+1).padStart(2,'0')])],project.base);
  $('base').disabled=project.mode==='新款';
  $('refRole').disabled=project.mode==='拆款';
  $('prompt').textContent=compose();
  $('api').textContent=project.mode==='拆款'?'调用 API 拆款':'调用 API 生成一张';
  $('sendBase').hidden=project.mode==='新款'||!basePicture();
  $('sendRef').hidden=project.mode==='拆款'||!project.reference;
  const instruction=project.mode==='新款'?(project.reference?'仅附参考图。':'可以直接粘贴提示词。'):
    project.mode==='拆款'?'附上本轮底图，返回的文字可粘贴到右侧「拆款文字」。':
    project.reference?'先附本轮底图，再附参考图。':'附上本轮底图。';
  $('actionHint').textContent='在 ChatGPT 中使用：'+instruction+(project.mode==='拆款'?'':' 下载效果图后拖到右侧。');
}
function renderReview(){
  const v=currentVersion();
  frame($('baseline'),v?v.original:project.original,'原款预览');
  frame($('candidate'),v?.asset,'候选方案预览');
  $('count').textContent=project.versions.length+' 个候选';
  $('versions').replaceChildren();
  project.versions.forEach((entry,i)=>{
    const btn=document.createElement('button');
    const title='方案 '+String(i+1).padStart(2,'0')+(entry.id===project.picked?' ✓':'');
    btn.className='thumb';btn.setAttribute('aria-pressed',String(entry===v));
    btn.append(imageElement(entry.asset),title);
    btn.onclick=guard(async()=>{project.focus=entry.id;renderReview();await save();});
    $('versions').append(btn);
    if(entry===v) $('candidateLabel').textContent=title+' · '+entry.mode;
  });
  if(!v) $('candidateLabel').textContent='候选方案';
  $('reviewOps').hidden=!v;
  $('note').value=v?.note || '';
  $('pick').textContent=v?.id===project.picked?'已选定 ✓':'选定此方案';
}
function render(){
  renderProjects();
  for(const id of ['code','refRole','brief','analysis']) $(id).value=project[id];
  renderAssets();renderTask();renderReview();
}
async function addAsset(file){
  const head=new Uint8Array(await file.slice(0,8).arrayBuffer());
  const png=head[0]===137 && head[1]===80 && head[2]===78 && head[3]===71;
  const jpg=head[0]===255 && head[1]===216 && head[2]===255;
  if(!png && !jpg) throw new Error('请选择 JPG 或 PNG 原图。');
  if(file.size>15*1024*1024) throw new Error('单张图片请控制在 15 MB 以内。');
  const blob=file.slice(0,file.size,png?'image/png':'image/jpeg');
  const url=URL.createObjectURL(blob);
  try{
    const probe=new Image();probe.src=url;await probe.decode();
  }catch{URL.revokeObjectURL(url);throw new Error('图片解码失败，请重新导出 JPG 或 PNG。');}
  const item={id:crypto.randomUUID(),name:file.name||'效果图.png',blob};
  await put('assets',item);pictures.set(item.id,item);urls.set(item.id,url);
  return item.id;
}
async function useFile(slot,file){
  if(!file) return;
  const target=project;
  const id=await addAsset(file);
  target[slot]=id;
  if(slot==='original' && !target.code) target.code=file.name.replace(/\.[^.]+$/,'').slice(0,90);
  await put('projects',target);
  if(project===target){render();status('图片已添加。');}
}
function droppable(el,handler){
  el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('over');});
  el.addEventListener('dragleave',()=>el.classList.remove('over'));
  el.addEventListener('drop',guard(async e=>{
    e.preventDefault();el.classList.remove('over');
    if(!e.dataTransfer.files.length) throw new Error('没有收到图片文件。请从 Billfish 导出原图后，再点选文件。');
    await handler(Array.from(e.dataTransfer.files));
  }));
}
async function addVersions(files,captured=snapshot(),target=project){
  for(const file of files){
    const asset=await addAsset(file);
    const entry={...captured,id:crypto.randomUUID(),asset,note:''};
    target.versions.push(entry);target.focus=entry.id;
    await put('projects',target);
    if(target===project){renderTask();renderReview();}
  }
  if(target===project) status('方案已加入当前款式。');
}
function dataUrl(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);
  });
}
async function assetById(id){return pictures.get(id)||await requestResult(db.transaction('assets').objectStore('assets').get(id));}
function filename(value){return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/,'').slice(0,100)||'款式';}
function download(name,blob){
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function versionName(){return filename(nameProject())+'_V'+String(project.versions.indexOf(currentVersion())+1).padStart(2,'0')+'_'+filename(currentVersion().mode);}
async function exportBlob(name,blob){
  if(!archiveFolder){download(name,blob);return;}
  const dot=name.lastIndexOf('.');
  const unique=name.slice(0,dot)+'_'+crypto.randomUUID().slice(0,12)+name.slice(dot);
  const file=await archiveFolder.getFileHandle(unique,{create:true});
  const writer=await file.createWritable();
  try{await writer.write(blob);await writer.close();}catch(error){await writer.abort().catch(()=>{});throw error;}
  status('已保存到「'+archiveFolder.name+'」：'+unique);
}
function downloadText(name,value){return exportBlob(name+'.txt',new Blob(['\uFEFF',value],{type:'text/plain;charset=utf-8'}));}
async function downloadInput(id,label){
  const item=await assetById(id);
  download(filename(nameProject())+'_'+label+(item.blob.type==='image/png'?'.png':'.jpg'),item.blob);
}
async function copyPrompt(){
  validate();
  const content=compose();
  try{await navigator.clipboard.writeText(content);}
  catch{
    const buffer=document.createElement('textarea');buffer.value=content;document.body.append(buffer);buffer.select();
    const ok=document.execCommand('copy');buffer.remove();
    if(!ok){document.querySelector('.prompt').open=true;throw new Error('请手动选中「本轮提示词」并复制。');}
  }
  project.handoff=snapshot();await save();
  status('提示词已复制。打开 ChatGPT，按左侧说明附图。');
}
function setPairing(code){
  pairing=code;
  $('api').hidden=!code;
  $('disconnect').hidden=!code;
  $('pairCode').value='';
  $('bridgeSummary').textContent=code?'本机 API 已连接':'连接本机 API，在本页生成';
}
async function bridgeRequest(path,code,data){
  let response;
  try{
    response=await fetch('http://127.0.0.1:18746/'+path,{
      method:'POST',credentials:'omit',cache:'no-store',redirect:'error',
      headers:{'Content-Type':'application/json','X-Studio-Pair':code},
      signal:AbortSignal.timeout(path==='pair'?10000:9*60*1000),
      body:JSON.stringify(data)
    });
  }catch{
    throw new Error(path==='pair'?'连接失败。请检查本机服务是否启动，并允许浏览器访问本机网络。':'连接中断。请先查看 API 用量，再决定是否重试。');
  }
  const answer=await response.json();
  if(!response.ok){
    if(response.status===401) setPairing('');
    throw new Error(answer.error || '本机服务返回错误。');
  }
  return answer;
}
async function callAPI(){
  validate();
  if(!pairing) throw new Error('请先连接本机 API。');
  const captured=snapshot(),ids=sourceIds(),target=project;
  $('api').disabled=true;document.querySelector('main').inert=true;status('正在调用 API，请保持本页打开…');
  try{
    const images=await Promise.all(ids.map(async id=>dataUrl((await assetById(id)).blob)));
    const answer=await bridgeRequest('run',pairing,{mode:captured.mode,prompt:captured.prompt,images});
    if(typeof answer.text==='string'){
      target.analysis=answer.text;await save();$('analysis').value=answer.text;document.querySelector('.analysis').open=true;status('已保存拆款文字。');
    }else{
      const blob=await (await fetch('data:image/png;base64,'+answer.image)).blob();
      await addVersions([new File([blob],'API方案.png',{type:'image/png'})],captured,target);
    }
  }finally{document.querySelector('main').inert=false;$('api').disabled=false;}
}
async function init(){
  const open=indexedDB.open('BagDesignStudio_v1',1);
  open.onupgradeneeded=()=>{
    open.result.createObjectStore('projects',{keyPath:'id'});open.result.createObjectStore('assets',{keyPath:'id'});
  };
  db=await requestResult(open);
  const saved=await requestResult(db.transaction('projects').objectStore('projects').getAll());
  saved.sort((a,b)=>b.updated-a.updated).forEach(p=>projects.set(p.id,p));
  project=saved[0]||blank();projects.set(project.id,project);await save();
  for(const task of Object.keys(tasks)){
    const b=document.createElement('button');b.textContent=task;b.onclick=guard(async()=>{project.mode=task;renderTask();await save();});$('modes').append(b);
  }
  for(const id of ['code','refRole','brief','analysis']){
    $(id).oninput=guard(async()=>{project[id]=$(id).value;if(id==='code')renderProjects();$('prompt').textContent=compose();await save();});
  }
  $('note').oninput=guard(async()=>{currentVersion().note=$('note').value;await save();});
  $('projects').onchange=guard(async()=>{project=projects.get($('projects').value);render();await save();status('已切换款式。');});
  $('newProject').onclick=guard(async()=>{project=blank();projects.set(project.id,project);render();$('code').focus();await save();status('新款式已建立。');});
  for(const [slot,clearButton] of [['original','clearOriginal'],['reference','clearRef']]){
    $(slot).onclick=()=>{inputSlot=slot;$('file').click();};
    droppable($(slot),files=>useFile(slot,files[0]));
    $(clearButton).onclick=guard(async()=>{project[slot]=null;render();await save();});
  }
  $('file').onchange=guard(async()=>{const f=$('file').files[0];$('file').value='';await useFile(inputSlot,f);});
  $('base').onchange=guard(async()=>{project.base=$('base').value;renderTask();await save();});
  $('manual').onclick=guard(copyPrompt);
  $('sendBase').onclick=guard(()=>downloadInput(basePicture(),baseTitle()));
  $('sendRef').onclick=guard(()=>downloadInput(project.reference,'参考图'));
  $('api').onclick=guard(callAPI);
  $('connect').onclick=async()=>{
    const code=$('pairCode').value.trim();
    $('bridgeStatus').classList.remove('error');
    if(!/^[a-f0-9]{32}$/.test(code)){
      $('bridgeStatus').textContent='请粘贴终端显示的 32 位配对码。';return;
    }
    $('connect').disabled=true;
    try{
      const reply=await bridgeRequest('pair',code,{});
      if(reply.paired!==true) throw new Error('本机服务没有确认连接。');
      setPairing(code);$('bridgeStatus').textContent='已连接。请点击上方的 API 按钮。';
    }catch(error){setPairing('');$('bridgeStatus').classList.add('error');$('bridgeStatus').textContent=error.message;}
    finally{$('connect').disabled=false;}
  };
  $('disconnect').onclick=()=>{setPairing('');$('bridgeStatus').textContent='已断开。';};
  $('import').onclick=()=>$('results').click();
  function importCandidates(files){return addVersions(files,project.handoff||snapshot());}
  $('results').onchange=guard(async()=>{const files=Array.from($('results').files);$('results').value='';await importCandidates(files);});
  droppable($('importArea'),importCandidates);
  $('pick').onclick=guard(async()=>{project.picked=currentVersion().id;renderReview();await save();status('已标记选定方案。');});
  $('reuse').onclick=guard(async()=>{project.base=currentVersion().asset;if(project.mode==='新款'||project.mode==='拆款')project.mode='改结构';renderTask();await save();$('brief').focus();status('本轮底图已切换。请填写下一轮修改意见。');});
  $('export').onclick=guard(async()=>{const a=await assetById(currentVersion().asset);await exportBlob(versionName()+(a.blob.type==='image/png'?'.png':'.jpg'),a.blob);});
  $('folder').hidden=typeof window.showDirectoryPicker!=='function';
  $('folder').onclick=guard(async()=>{
    try{archiveFolder=await window.showDirectoryPicker({mode:'readwrite',id:'bag-design-archive'});}
    catch(e){if(e.name==='AbortError')return;throw e;}
    $('folderNote').textContent='本次导出到：'+archiveFolder.name;
  });
  $('record').onclick=guard(async()=>{
    const v=currentVersion(),label=async id=>id?(await assetById(id))?.name||'': '无';
    await downloadText(versionName()+'_评审记录',['款式：'+nameProject(),'方案：'+versionName(),'选定：'+(project.picked===v.id?'是':'否'),'原款：'+await label(v.original),'本轮底图：'+await label(v.base),'参考图：'+await label(v.ref),'操作：'+v.mode,'评审意见：'+(v.note||'未填写'),'','生成要求',v.prompt].join('\r\n'));
  });
  $('saveAnalysis').onclick=guard(async()=>{if(!project.analysis.trim())throw new Error('请先填写拆款文字。');await downloadText(filename(nameProject())+'_拆款说明',project.analysis);});
  $('helpBtn').onclick=()=>$('help').showModal();$('closeHelp').onclick=()=>$('help').close();
  render();
}
init().catch(e=>status('工作台初始化失败：'+e.message+'。请用 Edge 或 Chrome 打开，并允许浏览器保存本地数据。',true));
