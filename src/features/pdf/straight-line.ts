import type {Point} from './geometry';
// Keep the existing pen-stroke format; only the two endpoints are needed.
export function straightLinePoints(start:Point,end:Point,width:number,height:number,lockAxis=false):Point[]{
  const a:Point=[start[0],start[1],.5],b:Point=[end[0],end[1],.5];
  if(lockAxis){if(Math.abs(b[0]-a[0])*width>=Math.abs(b[1]-a[1])*height)b[1]=a[1];else b[0]=a[0];}
  return [a,b];
}
