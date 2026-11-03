import {test} from 'node:test';
import assert from 'node:assert/strict';
import {restoreNavigation,persistNavigation} from '../public/navigation.js';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};};
test('restore selected conversation and explicit new conversation across refresh',()=>{
 const chats=[{id:'recent'},{id:'older'}],store=storage();
 assert.deepEqual(restoreNavigation(chats,store),{view:'chat',chatId:'recent'});
 persistNavigation('chat','older',store);assert.equal(restoreNavigation(chats,store).chatId,'older');
 persistNavigation('settings','older',store);assert.deepEqual(restoreNavigation(chats,store),{view:'settings',chatId:'older'});
 persistNavigation('chat',null,store);assert.deepEqual(restoreNavigation(chats,store),{view:'chat',chatId:null});
 assert.deepEqual(restoreNavigation([],{getItem:()=>{throw Error('disabled')}}),{view:'today',chatId:null});
});
test('browser reload resumes conversation; failed send keeps saved chat for retry',async()=>{
 const html=await readFile('public/index.html','utf8');
 const source=(await readFile('public/app.js','utf8')).replace(/^import .*;\r?\n/gm,'');
 let saved={tasks:[],memories:[],chats:[{id:'existing',title:'原来的对话',messages:[{role:'assistant',text:'已有回复'}]}],mode:'demo',settings:{configured:false,model:'test',baseUrl:'https://example.com'}};
 const requests=[];let fail=false;
 const dom=new JSDOM(html,{url:'http://localhost:3000',runScripts:'outside-only'});
 const w=dom.window;w.renderMarkdown=text=>text;w.restoreNavigation=restoreNavigation;w.persistNavigation=persistNavigation;
 w.fetch=async(url,options)=>{const input=options.body?JSON.parse(options.body):null;requests.push({url,input});
  if(url==='/api/state')return {ok:true,json:async()=>structuredClone(saved)};
  if(url==='/api/chats'){const chat={id:'created',title:input.title,messages:[]};saved.chats.unshift(chat);return {ok:true,json:async()=>chat};}
  if(fail)return {ok:false,json:async()=>({error:'模拟连接失败'})};
  const chat=saved.chats.find(c=>c.id===input.chatId);return {ok:true,json:async()=>chat};
 };
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 try{w.eval(source);await flush();assert.match(w.document.querySelector('#content').textContent,/已有回复/);
  w.document.querySelector('[data-view="conversations"]').click();
  assert.equal(w.document.querySelector('#content h1').textContent,'历史会话');
  assert.equal(w.document.querySelectorAll('.conversation-item').length,1);
  assert.equal(w.document.querySelector('.composer-wrap').hidden,true);
  assert.equal(JSON.parse(w.localStorage.getItem('qiban.navigation')).view,'conversations');
  w.document.querySelector('.conversation-item').click();
  assert.match(w.document.querySelector('#content').textContent,/已有回复/);
  assert.equal(w.document.querySelector('.composer-wrap').hidden,false);

  const send=async text=>{w.document.querySelector('#prompt').value=text;w.document.querySelector('#composer').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();};
  await send('继续');assert.equal(requests.filter(r=>r.url==='/api/chats').length,0);assert.equal(requests.find(r=>r.url==='/api/chat').input.chatId,'existing');
  w.document.querySelector('#new-chat').click();fail=true;await send('新话题');assert.equal(requests.filter(r=>r.url==='/api/chats').length,1);
  await send('重试');assert.equal(requests.filter(r=>r.url==='/api/chats').length,1);assert.equal(requests.at(-2).input.chatId,'created');
  assert.equal(JSON.parse(w.localStorage.getItem('qiban.navigation')).chatId,'created');
 }finally{w.close();}
});

