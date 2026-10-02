export function safeName(value:string){return value.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/\.{2,}/g,'_').replace(/[ .]+$/,'').slice(0,80)||'無題';}
export function markdown(value:unknown):string{
  if(!value||typeof value!=='object')return '';const n=value as Record<string,unknown>,a=(n.attrs??{}) as Record<string,unknown>,children=Array.isArray(n.content)?n.content:[];
  const body=children.map(markdown).join('');
  switch(n.type){
    case 'text':{let text=String(n.text??'').replace(/([\\`*_\[\]])/g,'\\$1');if(Array.isArray(n.marks))for(const m of n.marks){if(!m||typeof m!=='object')continue;const mark=m as Record<string,unknown>;if(mark.type==='bold')text=`**${text}**`;if(mark.type==='italic')text=`*${text}*`;if(mark.type==='code')text=`\`${text}\``;}return text;}
    case 'paragraph':return body+'\n\n';case 'heading':return '#'.repeat(Math.max(1,Math.min(6,Number(a.level)||2)))+' '+body+'\n\n';
    case 'bulletList':return children.map(c=>'- '+markdown(c).trim().replace(/\n/g,'\n  ')+'\n').join('')+'\n';
    case 'orderedList':return children.map((c,i)=>`${i+(Number(a.start)||1)}. `+markdown(c).trim().replace(/\n/g,'\n   ')+'\n').join('')+'\n';
    case 'taskList':return children.map(c=>{const item=c as Record<string,unknown>;return '- ['+((item.attrs as Record<string,unknown>)?.checked?'x':' ')+'] '+markdown(c).trim()+'\n';}).join('')+'\n';
    case 'blockMath':return '$$\n'+String(a.latex??'')+'\n$$\n\n';case 'inlineMath':return '$'+String(a.latex??'')+'$';
    case 'pageLink':return `[${String(a.label??'ページ')}]（資料 ${String(a.pdfDocId??'')}）`;
    case 'hardBreak':return '  \n';case 'horizontalRule':return '\n---\n\n';case 'codeBlock':return '```\n'+body+'\n```\n\n';case 'blockquote':return body.trim().replace(/^/gm,'> ')+'\n\n';default:return body;
  }
}
