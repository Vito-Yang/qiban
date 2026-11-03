import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {normalizeBaseUrl,updateSettings,writeProviderPatch} from '../settings.mjs';
import {probeProvider} from '../provider.mjs';
test('URL normalization preserves API path; changing credential recipient needs new key',()=>{
 assert.equal(normalizeBaseUrl('https://example.com/v1/chat/completions/'),'https://example.com/v1');
 assert.equal(normalizeBaseUrl('https://example.com/custom/'),'https://example.com/custom');
 assert.equal(normalizeBaseUrl('https://example.com'),'https://example.com');
 assert.throws(()=>normalizeBaseUrl('file:///tmp/a'));
 assert.throws(()=>normalizeBaseUrl('https://user:pass@example.com/v1'));
 assert.throws(()=>updateSettings({apiKey:'test',baseUrl:'https://a.example',model:'model'},{baseUrl:'https://b.example',model:'model'}),/重新填写/);
 assert.equal(updateSettings({apiKey:'test',baseUrl:'https://a.example',model:'model'},{model:'org/model:latest'}).model,'org/model:latest');
});
test('model discovery and inference use the same exact base path, auth, and selected model',async()=>{
 const seen=[];const server=http.createServer(async(req,res)=>{
  let raw='';for await(const part of req)raw+=part;
  seen.push({path:req.url,auth:req.headers.authorization,body:raw?JSON.parse(raw):null});
  res.setHeader('Content-Type','application/json');
  if(req.url==='/v1/models')return res.end(JSON.stringify({data:[{id:'org/model'}, {id:'org/model'},{id:'another'}]}));
  if(req.url==='/v1/chat/completions')return res.end(JSON.stringify({choices:[{message:{role:'assistant',content:'OK'}}]}));
  if(req.url==='/unauthorized/models'){res.statusCode=401;return res.end('{"error":"secret"}');}
  if(req.url==='/redirect/models'){res.writeHead(307,{Location:'/v1/models'});return res.end();}
  res.end('{}');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const draft={baseUrl:origin+'/v1',apiKey:'test-only',model:'org/model'};
 try{
  assert.deepEqual((await probeProvider(draft,'models')).models,['another','org/model']);
  assert.equal((await probeProvider(draft,'test')).ok,true);
  assert.equal(seen[0].auth,'Bearer test-only');assert.equal(seen[1].body.model,'org/model');
  assert.equal(seen[1].body.messages.length,1);
  await assert.rejects(probeProvider({...draft,baseUrl:origin+'/unauthorized'},'models'),/401/);
  await assert.rejects(probeProvider({...draft,baseUrl:origin+'/redirect'},'models'),/无法连接/);
  await assert.rejects(probeProvider({...draft,baseUrl:origin+'/invalid'},'models'),/格式不兼容/);
  const dir=await mkdtemp(path.join(tmpdir(),'qiban-provider-'));
  try{const patch=JSON.parse(await readFile(await writeProviderPatch(dir,draft),'utf8'));const profile=patch[0].config.providers['qiban-api'];assert.equal(profile.baseURL,draft.baseUrl);assert.equal(profile.models[0].id,draft.model);assert.equal(profile.api,'openai-completions');assert.ok(!JSON.stringify(patch).includes(draft.apiKey));}finally{await rm(dir,{recursive:true,force:true});}
 }finally{await new Promise(resolve=>server.close(resolve));}
});
