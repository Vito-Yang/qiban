import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import createDOMPurify from 'dompurify';
import {renderMarkdown} from '../public/markdown.js';
const window=new JSDOM('').window;
const purifier=createDOMPurify(window);
function parse(text){const host=window.document.createElement('div');host.innerHTML=renderMarkdown(text,purifier);return host;}
test('assistant Markdown renders headings, lists, tables, links, code and task lists',()=>{
 const host=parse('# 标题\n\n**重点** 与 `inline`\n\n- 第一项\n- 第二项\n\n> 引用\n\n```js\nconst value = "<tag>";\n```\n\n| 项目 | 状态 |\n| --- | --- |\n| 渲染 | 正常 |\n\n[文档](https://example.com)\n\n- [x] 已完成');
 assert.equal(host.querySelector('h1').textContent,'标题');assert.equal(host.querySelector('strong').textContent,'重点');
 assert.ok(host.querySelector('ul'));assert.ok(host.querySelector('blockquote'));assert.ok(host.querySelector('table'));
 assert.match(host.querySelector('pre code').textContent,/<tag>/);assert.equal(host.querySelector('a').href,'https://example.com/');
 const checkbox=host.querySelector('input');assert.equal(checkbox.type,'checkbox');assert.equal(checkbox.disabled,true);
});
test('Markdown cannot execute HTML, dangerous links or load remote images',()=>{
 const host=parse('<script>alert(1)</script><img src="https://evil.example/track" onerror="alert(1)"><iframe src="https://evil.example"></iframe>\n\n[bad](javascript:alert%281%29)\n\n<a href="javascript:alert(1)" onclick="alert(1)">bad</a>\n\n![tracking](https://evil.example/track)');
 assert.equal(host.querySelector('script,img,iframe,style,form'),null);
 assert.equal(host.querySelector('[onclick],[onerror]'),null);
 for(const link of host.querySelectorAll('a'))assert.ok(!link.getAttribute('href')?.startsWith('javascript:'));
});
