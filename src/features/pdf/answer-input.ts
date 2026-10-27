import type {TextBox} from '../../db/models';
export function answerLines(text:string){return text.replace(/\r\n?/g,'\n').split('\n');}
export function fitAnswer(box:TextBox,text:string,pageRatio:number,measuredWidth?:number):TextBox{
  const lines=answerLines(text),font=box.fontSize;
  const estimate=Math.max(...lines.map(line=>[...line].reduce((sum,char)=>sum+(char.charCodeAt(0)<256?.65:1),0)*font));
  const height=Math.min(1,font*1.45*pageRatio*lines.length);
  const x=Math.max(0,Math.min(1-font,box.x)),y=Math.max(0,Math.min(1-height,box.y));
  return {...box,kind:'answer',text:lines.join('\n'),x,y,width:Math.min(1-x,Math.max(font*1.5,(measuredWidth??estimate)+font*.4)),height};
}
export function answerAt(box:TextBox,x:number,y:number,pageRatio:number){return fitAnswer({...box,x,y},'',pageRatio);}

export function textAt(box:TextBox,x:number,y:number,pageWidth:number,pageHeight:number):TextBox{
  const left=Math.max(0,Math.min(1,x-12/pageWidth)),top=Math.max(0,Math.min(1,y-12/pageHeight));
  return {...box,x:left,y:top,width:Math.min(.32,1-left),height:Math.min(.12,1-top)};
}
export function isTextDrag(x:number,y:number,nextX:number,nextY:number){return Math.hypot(nextX-x,nextY-y)>=4;}
