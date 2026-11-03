// Small, bounded probes; never send memories, history, or files.
export async function probeProvider(settings, action) {
  if (!settings.apiKey) throw new Error('请先填写 API Key');
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),20000);
  const started = Date.now();
  try {
    const response = await fetch(settings.baseUrl+(action==='models'?'/models':'/chat/completions'), {
      method:action==='models'?'GET':'POST',redirect:'error',signal:controller.signal,
      headers:{Authorization:`Bearer ${settings.apiKey}`,'Content-Type':'application/json'},
      ...(action==='models'?{}:{body:JSON.stringify({model:settings.model,messages:[{role:'user',content:'Reply with OK.'}],max_tokens:16,stream:false})})
    });
    if(!response.ok){await response.body?.cancel();const hints={401:'密钥无效或未授权',403:'接口拒绝访问',404:'请检查接口 URL 或模型名称',429:'请求过多或额度不足'};throw new Error(`接口返回 HTTP ${response.status}：${hints[response.status]||'请求失败'}`);}
    const reader=response.body.getReader();let raw='',bytes=0;const decoder=new TextDecoder();
    while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2_000_000){await reader.cancel();throw new Error('接口响应过大');}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
    let data;try{data=JSON.parse(raw);}catch{throw new Error('接口返回的不是有效 JSON');}
    if(action==='models'){
      if(!Array.isArray(data.data))throw new Error('模型列表格式不兼容：需要 data 数组');
      const models=[...new Set(data.data.map(m=>m?.id).filter(id=>typeof id==='string'&&id.length>0&&id.length<=200))].sort();
      if(!models.length)throw new Error('接口没有返回可用模型');
      return {models};
    }
    if(!Array.isArray(data.choices)||!data.choices[0]?.message)throw new Error('响应格式不兼容 Chat Completions');
    return {ok:true,latencyMs:Date.now()-started,model:settings.model};
  }catch(e){
    if(controller.signal.aborted)throw new Error('连接超时（20 秒），请检查接口地址和网络');
    if(e instanceof TypeError)throw new Error('无法连接接口，请检查网络、URL 或是否发生重定向');
    throw e;
  }finally{clearTimeout(timer);}
}
