import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('tasks, memory, demo conversation and restart persistence',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'qiban-test-'));
 let child;
 const start=()=>new Promise((resolve,reject)=>{child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3197',DATA_DIR:dir,DEEPSEEK_API_KEY:''},stdio:['ignore','pipe','pipe']});child.once('error',reject);child.stdout.once('data',resolve);child.once('exit',code=>{if(code)reject(Error('Server exit '+code))});});
 const stop=()=>new Promise(resolve=>{child.once('exit',resolve);child.kill();});
 const call=async(p,method='GET',data)=>{const r=await fetch('http://127.0.0.1:3197'+p,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json()};};
 try{await start();assert.equal((await call('/api/state')).data.mode,'demo');
 assert.equal((await call('/api/tasks','POST',{title:''})).status,400);
 const tasks=(await call('/api/tasks','POST',{title:'准备产品方案'})).data;
 await call('/api/tasks/'+tasks[0].id,'PATCH',{done:true});
 await call('/api/memories','POST',{text:'喜欢上午专注工作'});
 const chat=(await call('/api/chat','POST',{text:'帮我安排今天'})).data;
 assert.equal(chat.messages.length,2);assert.match(chat.messages[1].text,/演示模式/);
 const continued=(await call('/api/chat','POST',{chatId:chat.id,text:'继续刚才的对话'})).data;
 assert.equal(continued.id,chat.id);assert.equal(continued.messages.length,4);
 assert.equal((await call('/api/state')).data.chats.length,1);
 assert.equal((await call('/api/chat','POST',{chatId:'missing',text:'不能静默新建'})).status,404);
 assert.equal((await call('/api/state')).data.chats.length,1);
 const draft=(await call('/api/chats','POST',{title:'发送前保存的对话'})).data;
 assert.equal(draft.messages.length,0);

 await stop();await start();const state=(await call('/api/state')).data;
 assert.equal(state.tasks[0].done,true);assert.equal(state.memories.length,1);assert.equal(state.chats.find(c=>c.id===chat.id).messages.length,4);assert.ok(state.chats.some(c=>c.id===draft.id));
 await call('/api/memories/'+state.memories[0].id,'DELETE');assert.equal((await call('/api/state')).data.memories.length,0);
 const fakeKey='sk-test-placeholder-only';
 assert.equal((await call('/api/settings','PUT',{apiKey:'bad key',model:'deepseek-v4-flash'})).status,400);
 const configured=await call('/api/settings','PUT',{apiKey:fakeKey,model:'deepseek-v4-flash'});
 assert.equal(configured.data.configured,true);assert.ok(!JSON.stringify(configured).includes(fakeKey));
 assert.ok(!JSON.stringify((await call('/api/state')).data).includes(fakeKey));
 await call('/api/settings','PUT',{apiKey:'',model:'deepseek-v4-flash'});
 await stop();await start();assert.equal((await call('/api/settings')).data.configured,true);
 const attack=await fetch('http://127.0.0.1:3197/api/settings',{method:'PUT',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:JSON.stringify({clearKey:true,model:'deepseek-v4-flash'})});
 assert.equal(attack.status,403);
 await call('/api/settings','PUT',{clearKey:true,model:'deepseek-v4-flash'});
 await stop();await start();assert.equal((await call('/api/state')).data.mode,'demo');

 }finally{if(child?.exitCode===null)await stop();await rm(dir,{recursive:true,force:true});}
});
