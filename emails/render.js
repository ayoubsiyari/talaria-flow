(function(g){
const C={bg:'#07080C',card:'#0E1017',line:'rgba(255,255,255,0.08)',text:'#F2F4F8',text2:'#B7BCCB',text3:'#8B90A3',text4:'#7C8296',cyan:'#2EE8FF',magenta:'#FF37B0',amber:'#FBBF24'};
const F="Archivo,'Helvetica Neue',Arial,sans-serif", M="'Geist Mono',Menlo,Consolas,monospace";
let face=F;
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
function bidi(s){return '<span dir="ltr" style="unicode-bidi:isolate">'+s+'</span>';}
function latinRun(s){
  s=String(s==null?'':s);
  if(/[A-Za-z]/.test(s)&&!/[\u0600-\u06FF]/.test(s)) return bidi(s);
  return s;
}
const blocks={
 p:b=>'<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:'+C.text2+'">'+b.text+'</p>',
 h2:b=>'<h2 style="margin:8px 0 12px;font-size:20px;line-height:1.3;color:'+C.text+';font-family:'+face+'">'+b.text+'</h2>',
 callout:b=>'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td style="background:'+C.bg+';border:1px solid '+C.line+';border-left:3px solid '+(b.color||C.cyan)+';border-radius:10px;padding:14px 16px">'+(b.label?'<div style="font-family:'+M+';font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:'+C.text3+';margin-bottom:6px">'+b.label+'</div>':'')+'<div style="font-size:15px;line-height:1.55;color:'+C.text+'">'+latinRun(b.text)+'</div></td></tr></table>',
 code:b=>'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px"><tr><td style="background:'+C.bg+';border:1px solid '+C.line+';border-radius:10px;padding:16px 24px;font-family:'+M+';font-size:32px;letter-spacing:.24em;color:'+C.text+'">'+b.value+'</td></tr></table>'+(b.note?'<p style="margin:0 0 20px;font-size:13px;color:'+C.text3+'">'+b.note+'</p>':'<div style="height:12px"></div>'),
 kv:b=>'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-top:1px solid '+C.line+'">'+(b.rows||[]).map(r=>'<tr><td style="padding:10px 12px 10px 0;border-bottom:1px solid '+C.line+';font-family:'+M+';font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:'+C.text3+';width:38%">'+r[0]+'</td><td style="padding:10px 0;border-bottom:1px solid '+C.line+';font-size:15px;color:'+C.text+'">'+bidi(r[1])+'</td></tr>').join('')+'</table>',
 steps:b=>'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-top:1px solid '+C.line+'">'+(b.items||[]).map((t,i)=>'<tr><td style="padding:12px 0;border-bottom:1px solid '+C.line+';font-family:'+M+';font-size:12px;color:'+C.cyan+';width:32px;vertical-align:top">0'+(i+1)+'</td><td style="padding:12px 0;border-bottom:1px solid '+C.line+';font-size:15px;line-height:1.55;color:'+C.text2+'">'+t+'</td></tr>').join('')+'</table>',
 list:b=>'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px">'+(b.items||[]).map(t=>'<tr><td style="padding:6px 0;width:18px;vertical-align:top"><span style="display:inline-block;width:6px;height:6px;background:'+C.cyan+';margin-top:8px"></span></td><td style="padding:6px 0;font-size:15px;line-height:1.55;color:'+C.text2+'">'+t+'</td></tr>').join('')+'</table>',
 button:b=>'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 12px"><tr><td style="background:'+(b.variant==='outline'?'transparent':C.cyan)+';border:1px solid '+C.cyan+';border-radius:10px"><a href="'+(b.href||'#')+'" style="display:inline-block;padding:14px 24px;color:'+(b.variant==='outline'?C.cyan:'#04141A')+';font-weight:700;font-size:15px;text-decoration:none;font-family:'+face+'">'+(b.label||'')+'</a></td></tr></table>'+(b.fallback===false?'':'<p dir="ltr" style="unicode-bidi:isolate;margin:0 0 20px;font-size:12.5px;line-height:1.6;color:'+C.text3+'">If the button does not work, copy this link:<br><span style="color:'+C.text2+';word-break:break-all">'+bidi(b.href||'#')+'</span></p>'),
 divider:()=>'<div style="border-top:1px solid '+C.line+';margin:8px 0 24px"></div>',
 spacer:b=>'<div style="height:'+(b.height||16)+'px;line-height:0;font-size:0">&nbsp;</div>',
 image:b=>'<img src="'+b.src+'" width="544" alt="'+esc(b.alt)+'" style="display:block;width:100%;max-width:544px;height:auto;border-radius:10px;margin:0 0 20px">',
 status:b=>'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr><td dir="ltr" style="unicode-bidi:isolate;border:1px solid '+b.color+';border-radius:6px;padding:5px 10px;font-family:'+M+';font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:'+b.color+'"><span style="display:inline-block;width:6px;height:6px;background:'+b.color+';margin-right:8px;vertical-align:middle"></span>'+b.text+'</td></tr></table>'
};
function inheritHrefs(enBlocks, arBlocks){
  return (arBlocks||[]).map(function(b,i){
    var en=(enBlocks||[])[i]||{};
    if(b.type==='button') return Object.assign({},b,{href:b.href||en.href});
    if(b.type==='image') return Object.assign({},b,{src:b.src||en.src});
    return b;
  });
}
function render(t,opts){
  opts=opts||{};
  var wantAr=opts.lang==='ar'||t.lang==='ar';
  if(wantAr&&t.ar){
    var enBlocks=t.blocks;
    t=Object.assign({},t,t.ar,{lang:'ar',accent:t.accent,unsubscribe:t.unsubscribe});
    t.blocks=inheritHrefs(enBlocks,t.blocks);
  }else if(opts.lang==='en'){
    t=Object.assign({},t,{lang:'en'});
  }
  const base=opts.baseUrl!=null?opts.baseUrl:'https://www.talaria-flow.com/';
  const logo=opts.logoUrl||(base+'assets/email-logo-2x.png?v=1');
  const ar=t.lang==='ar';
  face=ar?"'Cairo','Segoe UI',Tahoma,sans-serif":F;
  const accent=t.accent||C.cyan;
  const body=(t.blocks||[]).map(b=>blocks[b.type]?blocks[b.type](b):'').join('');
  return '<!doctype html><html lang="'+(t.lang||'en')+'" dir="'+(ar?'rtl':'ltr')+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="dark"><title>'+esc(t.subject)+'</title></head>'
+'<body style="margin:0;padding:0;background:'+C.bg+';font-family:'+face+'"><div style="display:none;max-height:0;overflow:hidden;opacity:0">'+esc(t.preheader)+'</div>'
+'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:'+C.bg+'"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">'
+'<tr><td style="padding:0 4px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle"><a href="https://www.talaria-flow.com" style="text-decoration:none;color:'+C.text+'"><img src="'+logo+'" width="32" height="36" alt="Talaria Flow" style="display:inline-block;vertical-align:middle;border:0;outline:none;margin-right:10px"><span style="display:inline-block;vertical-align:middle;font-size:17px;font-family:'+face+'"><b>Talaria</b> <span style="color:'+C.text3+'">Flow</span></span></a></td><td align="right" style="vertical-align:middle;font-family:'+M+';font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:'+C.text3+'">'+(t.eyebrow||'')+'</td></tr></table></td></tr>'
+'<tr><td style="background:'+C.card+';border:1px solid '+C.line+';border-top:3px solid '+accent+';border-radius:14px;padding:32px 28px 20px;text-align:'+(ar?'right':'left')+'"><h1 style="margin:0 0 16px;font-size:28px;line-height:1.15;letter-spacing:-0.02em;font-weight:700;color:'+C.text+';font-family:'+face+'">'+t.title+'</h1>'+body+'</td></tr>'
+'<tr><td dir="ltr" style="unicode-bidi:isolate;padding:24px 4px 0;font-family:'+M+';font-size:11px;line-height:1.7;color:'+C.text4+';text-align:left"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-family:'+M+';font-size:11px;color:'+C.text4+'">Questions? <a href="mailto:support@talaria-flow.com" style="color:'+C.text3+'">support@talaria-flow.com</a></td><td align="right" style="font-family:'+M+';font-size:11px"><a href="https://www.youtube.com/@talariatrade" style="color:'+C.text3+';text-decoration:none">YouTube</a> · <a href="https://x.com/Talaria_trade" style="color:'+C.text3+';text-decoration:none">X</a> · <a href="https://t.me/Talaria_trade" style="color:'+C.text3+';text-decoration:none">Telegram</a> · <a href="https://www.instagram.com/talariatrade/" style="color:'+C.text3+';text-decoration:none">Instagram</a></td></tr></table><div style="border-top:1px solid '+C.line+';margin:14px 0"></div>Talaria-Log Ltd · Registered in England and Wales, company no. 16724003 · 71-75 Shelton Street, Covent Garden, London WC2H 9JQ, United Kingdom<br>Talaria Flow is an independent Ecosystem partner and is not affiliated with, endorsed by, or an agent of NinjaTrader.'+(t.unsubscribe===false?'':'<br><a href="{{unsubscribe_url}}" style="color:'+C.text4+'">Unsubscribe</a> · <a href="{{preferences_url}}" style="color:'+C.text4+'">Email preferences</a>')+'</td></tr></table></td></tr></table></body></html>';
}
g.TFEmail={render,bidi,blocks:Object.keys(blocks),colors:C};
})(typeof window!=='undefined'?window:globalThis);
