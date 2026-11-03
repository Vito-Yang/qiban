import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
export const DEFAULT_URL = 'https://api.deepseek.com';
export function normalizeBaseUrl(value) {
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('请输入有效的接口 URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('接口 URL 仅支持 HTTP(S)，不能包含账号、查询参数或片段');
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/, '').replace(/\/+$/, '');
  return url.href.replace(/\/+$/, '');
}
export async function loadSettings(root) {
  try { const saved = JSON.parse(await readFile(path.join(root, 'settings.json'), 'utf8')); return {...saved, baseUrl:normalizeBaseUrl(saved.baseUrl || DEFAULT_URL)}; }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { apiKey: process.env.DEEPSEEK_API_KEY || '', model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash', baseUrl: normalizeBaseUrl(process.env.DEEPSEEK_BASE_URL || DEFAULT_URL) };
  }
}
export function publicSettings(settings) { return { configured: Boolean(settings.apiKey), model: settings.model, baseUrl: settings.baseUrl }; }
export function updateSettings(current, input, {requireModel=true}={}) {
  const model = input.model ?? current.model;
  if (requireModel && (typeof model !== 'string' || !model.trim() || model.length > 200 || /[\s\x00-\x1f]/.test(model))) throw new Error('请输入有效的模型名称');
  if (input.apiKey !== undefined && (typeof input.apiKey !== 'string' || input.apiKey.length > 500 || /\s/.test(input.apiKey))) throw new Error('API Key 不应包含空白字符，且长度不能超过 500');
  const baseUrl = normalizeBaseUrl(input.baseUrl ?? current.baseUrl ?? DEFAULT_URL);
  if (current.apiKey && !input.apiKey && !input.clearKey && new URL(baseUrl).origin !== new URL(current.baseUrl || DEFAULT_URL).origin) throw new Error('接口域名已变化，请重新填写 API Key 后继续');
  return { apiKey: input.clearKey === true ? '' : input.apiKey || current.apiKey, model, baseUrl };
}
export async function saveSettings(root, settings) {
  const target = path.join(root, 'settings.json');
  await writeFile(target + '.tmp', JSON.stringify(settings, null, 2), { mode: 0o600 });
  await rename(target + '.tmp', target);
}
export async function writeProviderPatch(root, settings) {
  const target = path.join(root, 'provider.patch.json');
  // JSON is valid YAML. Credentials are referenced through the child environment only.
  const patch = [{id:'llm-pi-ai',config:{providers:{'qiban-api':{displayName:'栖伴模型接口',apiKeyEnv:'QIBAN_API_KEY',api:'openai-completions',baseURL:settings.baseUrl,models:[{id:settings.model,contextWindow:32768,maxTokens:4096}],retryPolicy:{mode:'normal',maxRetries:0}}}}}];
  await writeFile(target,JSON.stringify(patch,null,2));return target;
}
