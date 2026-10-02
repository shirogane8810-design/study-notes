import type {TextBox} from '../../db/models';
export type Corner='nw'|'ne'|'sw'|'se';
export function transformTextBox(box:TextBox,dx:number,dy:number,corner?:Corner):TextBox{
  if(!corner)return {...box,x:Math.max(0,Math.min(1-box.width,box.x+dx)),y:Math.max(0,Math.min(1-box.height,box.y+dy))};
  const right=box.x+box.width,bottom=box.y+box.height;
  const x=corner.includes('w')?Math.max(0,Math.min(right-.08,box.x+dx)):box.x;
  const y=corner.includes('n')?Math.max(0,Math.min(bottom-.04,box.y+dy)):box.y;
  const endX=corner.includes('e')?Math.min(1,Math.max(x+.08,right+dx)):right;
  const endY=corner.includes('s')?Math.min(1,Math.max(y+.04,bottom+dy)):bottom;
  return {...box,x,y,width:endX-x,height:endY-y};
}
export function wheelZoom(zoom:number,delta:number,mode:number){return Math.max(.5,Math.min(3,zoom*Math.exp(-delta*(mode===1?16:mode===2?800:1)*.01)));}
