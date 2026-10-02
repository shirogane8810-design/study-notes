import type {Stroke} from '../../db/models';
export type Point = [number,number,number];
export type Rotation = 0|90|180|270;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export function rotatePoint([x,y,p]:Point,rotation:Rotation):Point {
  switch(rotation){case 90:return[1-y,x,p];case 180:return[1-x,1-y,p];case 270:return[y,1-x,p];default:return[x,y,p];}
}
export function normalizePoint(x:number,y:number,rect:{left:number;top:number;width:number;height:number},pressure:number,rotation:Rotation):Point {
  return rotatePoint([clamp((x-rect.left)/rect.width),clamp((y-rect.top)/rect.height),clamp(pressure)],((360-rotation)%360) as Rotation);
}
export function pressureWidth(width:number,pressure:number,tool:Stroke['tool']){return tool==='highlighter'?width:width*(.35+Math.max(.05,pressure)*1.3);}
function distance(point:[number,number],a:[number,number],b:[number,number]){
  const dx=b[0]-a[0],dy=b[1]-a[1];const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy);
}
export function hitStroke(stroke:Stroke,point:Point,width:number,height:number,radius:number){
  const p:[number,number]=[point[0]*width,point[1]*height];
  const threshold=radius+stroke.width*width;
  return stroke.points.some((v,i)=>distance(p,[v[0]*width,v[1]*height],[(stroke.points[i+1]??v)[0]*width,(stroke.points[i+1]??v)[1]*height])<=threshold);
}
export interface Change { added:Stroke[]; removed:Stroke[] }
export function applyChange(strokes:Stroke[],change:Change,undo=false){
  const remove=new Set((undo?change.added:change.removed).map(s=>s.id));
  const add=undo?change.removed:change.added;const addIds=new Set(add.map(s=>s.id));
  return [...strokes.filter(s=>!remove.has(s.id)&&!addIds.has(s.id)),...add];
}
export function visiblePages(offsets:number[],heights:number[],scrollTop:number,viewportHeight:number,overscan=1){
  const start=offsets.findIndex((top,i)=>top+heights[i]>=scrollTop);
  let end=Math.max(0,start);while(end<offsets.length-1&&offsets[end]<scrollTop+viewportHeight)end++;
  return {start:Math.max(0,(start<0?offsets.length-1:start)-overscan),end:Math.min(offsets.length-1,end+overscan)};
}
