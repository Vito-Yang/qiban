import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css=await readFile('public/style.css','utf8');
const colorPattern=/#[0-9a-f]{3,8}\b/gi;
const hexToRgb=hex=>{
 const value=hex.replace('#','').slice(0,6);
 if(value.length===3)return [...value].map(char=>parseInt(char+char,16));
 return [0,2,4].map(index=>parseInt(value.slice(index,index+2),16));
};
const luminance=hex=>{
 const channels=hexToRgb(hex).map(value=>value/255).map(value=>value<=.03928?value/12.92:((value+.055)/1.055)**2.4);
 return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
};
const contrast=(a,b)=>{
 const [light,dark]=[luminance(a),luminance(b)].sort((x,y)=>y-x);
 return (light+.05)/(dark+.05);
};
const rule=selector=>{
 const pattern=new RegExp(`(?:^|[},])\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*\\{([^}]*)\\}`,'m');
 const match=css.match(pattern);
 assert.ok(match,`missing CSS rule: ${selector}`);
 return match[1];
};
const background=selector=>{
 const match=rule(selector).match(/background(?:-color)?\s*:\s*(#[0-9a-f]{3,8})/i);
 assert.ok(match,`missing background in ${selector}`);
 return match[1];
};
const foreground=selector=>{
 const match=rule(selector).match(/(?:^|;)\s*color\s*:\s*(#[0-9a-f]{3,8})/i);
 assert.ok(match,`missing color in ${selector}`);
 return match[1];
};
const assertContrast=(label,front,back,minimum)=>{
 const ratio=contrast(front,back);
 assert.ok(ratio>=minimum,`${label} contrast ${ratio.toFixed(2)} is below ${minimum} (${front} on ${back})`);
};

test('homepage palette is blue and the former green accents are gone',()=>{
 const colors=[...new Set(css.match(colorPattern).map(color=>color.toLowerCase()))];
 const semanticDanger='#b04a42';
 for(const color of colors){
  if(color===semanticDanger)continue;
  const [red,green,blue]=hexToRgb(color);
  const grayscale=red===green&&green===blue;
  if(grayscale)continue;
  assert.ok(blue>=green&&blue>=red,`${color} is not a blue-dominant theme color`);
 }
 const legacyGreens=['#30332d','#303a29','#7d925e','#fafbf6','#dce1d1','#48563b','#24351104','#929b85','#70776a','#e1e7d7','#354a25','#89917e','#969d8e','#747c6d','#dce2d1','#859b65','#929a88','#dee5d3','#71825c','#838a7b','#c3c9b9','#969e8c','#8a967d','#809569','#92988b','#eef2e6','#e2e8d6','#dce5ce','#7d9067','#87927b','#627b4d','#a0a792','#e5e8df','#b8c7a3','#f0f2e9','#8a9c70','#f8efe5','#bb9867','#edf0f6','#8c9bb8','#a5ad9c','#7e9663','#dfe4d5','#34422106','#f1f4eb','#83956f','#e7eadf','#a1a994','#969f8c','#9aa48c','#a0a994','#939f84','#8c9d79','#809569','#e3e8d9','#939d87','#839a69','#929b87','#7b856e','#6f8359','#e3e6db','#b6c6a0','#7b856f','#f5f7f0','#e1e6d8','#5e7a43','#f0f3e9','#f5f8ef','#9caf85','#909a84','#869773'];
 for(const color of legacyGreens)assert.ok(!colors.includes(color),`legacy green color ${color} is still present`);

 assertContrast('body text',foreground(':root'),background(':root'),7);
 assertContrast('sidebar navigation',foreground('.nav button'),background('aside'),4.5);
 assertContrast('sidebar meta',foreground('.nav small'),background('aside'),4.5);
 assertContrast('active navigation',foreground('.nav button.active'),background('.nav button.active'),4.5);
 assertContrast('secondary copy',foreground('.sub'),background(':root'),4.5);
 assertContrast('primary button label',rule('.primary').match(/color\s*:\s*(#[0-9a-f]{3,8})/i)?.[1]||'#ffffff',background('.primary'),4.5);
 assertContrast('send button label','#ffffff',background('#send'),4.5);
 assertContrast('today note text',foreground('.brief p'),background('.brief'),4.5);
 assertContrast('composer placeholder',foreground('textarea::placeholder'),'#ffffff',4.5);
 assertContrast('card copy',foreground('.card p'),background('.card'),4.5);
 assertContrast('Markdown links',foreground('.markdown-body a'),'#ffffff',4.5);
 assertContrast('error message',foreground('#error'),background(':root'),4.5);
});

const includes=(label,fragment)=>assert.ok(css.includes(fragment),`missing CSS: ${fragment}`);

test('hover, focus and disabled states stay visible',()=>{
 includes('navigation hover','.nav button:hover{background');
 includes('history hover','#history button:hover{background');
 includes('primary hover','.primary:hover{background');
 includes('secondary hover','.secondary:hover{background');
 includes('send hover','#send:hover:not(:disabled){background');
 includes('focus outline','button:focus-visible,a:focus-visible{outline:2px solid');
 includes('send disabled','#send:disabled{opacity');
 includes('primary disabled','.primary:disabled,.secondary:disabled{opacity');
 includes('input focus','.settings-form input:focus{outline');
});

test('desktop and narrow-screen rules remain in place',()=>{
 includes('1000px layout','@media(max-width:1000px){aside{width:200px}');
 includes('650px layout','@media(max-width:650px){aside{width:65px');
 includes('single-column cards','.cards{grid-template-columns:1fr}');
});
