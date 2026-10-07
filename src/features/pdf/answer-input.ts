import type {TextBox} from '../../db/models';
export function singleLine(text:string){return text.replace(/[\r\n]+/g,' ');}
export function fitAnswer(box:TextBox,text:string,pageRatio:number,measuredWidth?:number):TextBox{
  const clean=singleLine(text),font=box.fontSize;
  const estimate=[...clean].reduce((sum,char)=>sum+(char.charCodeAt(0)<256?.65:1),0)*font;
  const height=Math.min(1,font*1.45*pageRatio);
  const x=Math.max(0,Math.min(1-font,box.x)),y=Math.max(0,Math.min(1-height,box.y));
  return {...box,kind:'answer',text:clean,x,y,width:Math.min(1-x,Math.max(font*1.5,(measuredWidth??estimate)+font*.4)),height};
}
export function answerAt(box:TextBox,x:number,y:number,pageRatio:number){return fitAnswer({...box,x,y:y-box.fontSize*1.2*pageRatio},'',pageRatio);}
