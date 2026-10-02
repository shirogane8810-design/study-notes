import {useEffect,useRef,useState,type PointerEvent} from 'react';
import type {Stroke} from '../../db/models';
import {normalizePoint,rotatePoint,type Change,type Point,type Rotation} from './geometry';
import {lassoSelect,moveStrokes,strokeBounds} from './lasso-geometry';
export function LassoPage({strokes,selected,width,height,rotation,fingerDraw,onSelect,onChange,onActivity,cancelTouch}:{strokes:Stroke[];selected:string[];width:number;height:number;rotation:Rotation;fingerDraw:boolean;onSelect:(ids:string[])=>void;onChange:(c:Change)=>void;onActivity:(active:boolean,kind?:string)=>void;cancelTouch:number}){
  const svg=useRef<SVGSVGElement>(null);const gesture=useRef<{id:number;kind:string;start:Point;polygon:Point[];moving:Stroke[];dx:number;dy:number}|undefined>(undefined);
  const [path,setPath]=useState<Point[]>([]),[delta,setDelta]=useState<[number,number]>([0,0]);
  const chosen=strokes.filter(s=>selected.includes(s.id)),bounds=strokeBounds(chosen);
  const latest=useRef(onActivity);latest.current=onActivity;
  function cancel(){gesture.current=undefined;setPath([]);setDelta([0,0]);latest.current(false);}
  useEffect(()=>{if(gesture.current?.kind==='touch')cancel();},[cancelTouch]);
  useEffect(()=>()=>{if(gesture.current)latest.current(false);},[]);
  function point(e:PointerEvent<SVGSVGElement>){return normalizePoint(e.clientX,e.clientY,e.currentTarget.getBoundingClientRect(),.5,rotation);}
  function down(e:PointerEvent<SVGSVGElement>){if(e.button!==0||gesture.current||(e.pointerType==='touch'&&!fingerDraw))return;e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);const p=point(e);const moving=bounds&&p[0]>=bounds.x-.01&&p[0]<=bounds.right+.01&&p[1]>=bounds.y-.01&&p[1]<=bounds.bottom+.01?chosen:[];gesture.current={id:e.pointerId,kind:e.pointerType,start:p,polygon:[p],moving,dx:0,dy:0};setPath(moving.length?[]:[p]);onActivity(true,e.pointerType);}
  function move(e:PointerEvent<SVGSVGElement>){const g=gesture.current;if(!g||g.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();const p=point(e);if(g.moving.length){g.dx=p[0]-g.start[0];g.dy=p[1]-g.start[1];const shifted=moveStrokes(g.moving,g.dx,g.dy),b=strokeBounds(shifted),a=strokeBounds(g.moving);setDelta(b&&a?[b.x-a.x,b.y-a.y]:[0,0]);}else {g.polygon.push(p);setPath([...g.polygon]);}}
  function finish(e:PointerEvent<SVGSVGElement>){const g=gesture.current;if(!g||g.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();if(g.moving.length){if(g.dx||g.dy)onChange({removed:g.moving,added:moveStrokes(g.moving,g.dx,g.dy)});}else onSelect(lassoSelect(strokes,g.polygon).map(s=>s.id));cancel();}
  const corners=bounds?[[bounds.x+delta[0],bounds.y+delta[1],.5],[bounds.right+delta[0],bounds.y+delta[1],.5],[bounds.right+delta[0],bounds.bottom+delta[1],.5],[bounds.x+delta[0],bounds.bottom+delta[1],.5]] as Point[]:[];
  const polygon=(points:Point[])=>points.map(p=>{const r=rotatePoint(p,rotation);return `${r[0]*width},${r[1]*height}`;}).join(' ');
  return <svg ref={svg} className="lasso-layer" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="投げ縄で手書きを囲む" onPointerDown={down} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel}>
    {corners.length>0&&<polygon points={polygon(corners)} fill="#2563eb12" stroke="#2563eb" strokeWidth="2" strokeDasharray="5 4"/>}
    {path.length>0&&<polyline points={polygon(path)} fill="#2563eb10" stroke="#2563eb" strokeWidth="2" strokeDasharray="5 4"/>}
  </svg>;
}
