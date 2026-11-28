'use strict';
const http = require('node:http');
const {randomBytes} = require('node:crypto');
const {Writable} = require('node:stream');
const readline = require('node:readline');
const siteOrigin = 'https://cargo-ops-tools.github.io';
const modes = new Set(['换料','换色','改结构','拆款','新款']);
const imagePattern = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;
function problem(message, status=400){return Object.assign(new Error(message),{status});}
async function parseRequest(request){
  let size=0; const pieces=[];
  for await(const piece of request){
    size+=piece.length;
    if(size>41*1024*1024) throw problem('输入文件太大。',413);
    pieces.push(piece);
  }
  let value;
  try{ value=JSON.parse(Buffer.concat(pieces).toString('utf8')); }
  catch{ throw problem('请求内容无效。'); }
  if(!value || !modes.has(value.mode) || typeof value.prompt!=='string' || !value.prompt.trim() || value.prompt.length>24000) throw problem('请检查操作方式和设计要求。');
  if(!Array.isArray(value.images) || value.images.length>2) throw problem('最多使用两张图。');
  if(value.mode!=='新款' && !value.images.length) throw problem('此操作需要一张底图。');
  for(const image of value.images) {
    if(typeof image!=='string' || image.length>20*1024*1024+32 || !imagePattern.test(image)) throw problem('图片格式或大小超限。');
  }
  return value;
}
async function runModel(input, key, call=fetch){
  const imageModel=process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
  const headers={Authorization:'Bearer '+key};
  let endpoint,body;
  if(input.mode==='拆款'){
    endpoint='responses';headers['Content-Type']='application/json';
    body=JSON.stringify({model:process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini',store:false,
      input:[{role:'user',content:[{type:'input_text',text:input.prompt},{type:'input_image',image_url:input.images[0]}]}]});
  }else if(input.images.length){
    endpoint='images/edits';
    body=new FormData();body.set('model',imageModel);body.set('prompt',input.prompt);body.set('quality','medium');
    body.set('size','auto');body.set('n','1');
    for(const [i,url] of input.images.entries()){
      const [,kind,data]=imagePattern.exec(url);
      body.append('image[]',new Blob([Buffer.from(data,'base64')],{type:'image/'+kind}),'input-'+(i+1)+'.'+kind);
    }
  }else{
    endpoint='images/generations';headers['Content-Type']='application/json';
    body=JSON.stringify({model:imageModel,prompt:input.prompt,quality:'medium',size:'auto',n:1});
  }
  let remote;
  try{remote=await call('https://api.openai.com/v1/'+endpoint,{method:'POST',headers,body,redirect:'error',signal:AbortSignal.timeout(8*60*1000)});}
  catch{throw problem('未收到 API 响应。请核对网络，并先查看 API 用量再决定是否重试。',502);}
  const result=await remote.json().catch(()=>({}));
  if(!remote.ok){
    const hints={400:'图片、提示词或模型参数未被接受',401:'API Key 未通过验证',403:'当前 API 组织没有相应模型权限',404:'模型不可用，请检查模型配置',429:'余额、速率或配额受限'};
    const code=String(result.error?.code || '').replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,64);
    throw problem((hints[remote.status]||'模型服务返回错误')+'（HTTP '+remote.status+(code?'，'+code:'')+'）。',502);
  }
  if(input.mode==='拆款'){
    const text=(result.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n').trim();
    if(!text) throw problem('模型没有返回拆款文字。',502);
    return {text};
  }
  if(typeof result.data?.[0]?.b64_json!=='string') throw problem('模型没有返回图片。',502);
  return {image:result.data[0].b64_json};
}
function makeServer({key,pairCode,origin=siteOrigin,call=fetch}){
  if(!key || !pairCode) throw new Error('启动服务需要 API Key 和配对码。');
  let busy=false;
  const service=http.createServer(async(req,res)=>{
    const json=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try{
      const host='127.0.0.1:'+service.address().port;
      if(req.headers.host!==host) throw problem('仅允许本机访问。',403);
      res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('Referrer-Policy','no-referrer');
      res.setHeader('X-Frame-Options','DENY');
      if(req.headers.origin!==origin) throw problem('来源未配对。',403);
      res.setHeader('Access-Control-Allow-Origin',origin);
      res.setHeader('Vary','Origin');
      if(req.method==='OPTIONS'){
        res.writeHead(204,{'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Studio-Pair','Access-Control-Allow-Private-Network':'true'});
        return res.end();
      }
      if(req.method!=='POST' || !['/pair','/run'].includes(req.url)) return json(404,{error:'请求无效。'});
      if(req.headers['x-studio-pair']!==pairCode) throw problem('配对码失效或有误，请复制当前终端中的配对码。',401);
      if(req.url==='/pair') return json(200,{paired:true});
      if(req.headers['content-type']!=='application/json') throw problem('请求格式有误。',415);
      if(busy) throw problem('已有生成任务正在运行，请稍候。',409);
      const input=await parseRequest(req);
      if(busy) throw problem('已有生成任务正在运行，请稍候。',409);
      busy=true;
      try{json(200,await runModel(input,key,call));}finally{busy=false;}
    }catch(err){if(!res.headersSent&&!res.destroyed)json(err.status||500,{error:err.status?err.message:'本机服务暂时无法处理请求。'});}
  });
  return service;
}
async function readKey(){
  if(process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  if(!process.stdin.isTTY) throw new Error('请在终端启动本机服务，或预先设置 OPENAI_API_KEY。');
  process.stdout.write('在本机粘贴 OpenAI API Key 并按回车（输入隐藏）：');
  const silent=new Writable({write(_chunk,_encoding,done){done();}});
  const input=readline.createInterface({input:process.stdin,output:silent,terminal:true,historySize:0});
  try{return await new Promise((resolve,reject)=>{
    input.once('SIGINT',()=>reject(new Error('已取消。')));
    input.question('',s=>resolve(s.trim()));
  });}finally{input.close();process.stdout.write('\n');}
}
async function start(){
  if(Number(process.versions.node.split('.')[0])<20) throw new Error('请先安装 Node.js 20 或更高版本。');
  const key=await readKey();
  if(!key) throw new Error('没有输入 API Key。');
  const pairCode=randomBytes(16).toString('hex');
  const service=makeServer({key,pairCode});
  service.on('error',err=>{console.error(err.code==='EADDRINUSE'?'端口 18746 已占用，请关闭旧服务后重试。':err.message);process.exitCode=1;});
  service.listen(18746,'127.0.0.1',()=>{
    console.log('打开 '+siteOrigin+'/AMAZON-topeast/#/product-images');
    console.log('本次配对码：'+pairCode+'\n将配对码粘贴到网页。保持此终端打开，结束后按 Ctrl+C。');
  });
}
if(require.main===module) start().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={makeServer};
