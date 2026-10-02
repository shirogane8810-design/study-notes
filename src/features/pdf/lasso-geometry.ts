import type {Stroke} from '../../db/models';
import type {Point} from './geometry';
export function insidePolygon(point:Point,polygon:Point[]){
  let inside=false;const[x,y]=point;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const[a,b]=polygon[i],[c,d]=polygon[j];
    if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;
  }return inside;
}
function crosses(a:Point,b:Point,c:Point,d:Point){
  const cross=(p:Point,q:Point,r:Point)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
  return abC*abD<=0&&cdA*cdB<=0&&Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]));
}
export function lassoSelect(strokes:Stroke[],polygon:Point[]){
  if(polygon.length<3)return [];
  return strokes.filter(s=>s.points.some((p,i)=>insidePolygon(p,polygon)||(i>0&&polygon.some((q,j)=>crosses(s.points[i-1],p,q,polygon[(j+1)%polygon.length])))));
}
export function strokeBounds(strokes:Stroke[]){
  let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  for(const stroke of strokes)for(const point of stroke.points){x=Math.min(x,point[0]);y=Math.min(y,point[1]);right=Math.max(right,point[0]);bottom=Math.max(bottom,point[1]);}
  return Number.isFinite(x)?{x,y,right,bottom}:undefined;
}
export function moveStrokes(strokes:Stroke[],dx:number,dy:number){
  const box=strokeBounds(strokes);if(!box)return strokes;
  dx=Math.max(-box.x,Math.min(1-box.right,dx));dy=Math.max(-box.y,Math.min(1-box.bottom,dy));
  return strokes.map(s=>({...s,points:s.points.map(([x,y,p]):Point=>[x+dx,y+dy,p])}));
}
