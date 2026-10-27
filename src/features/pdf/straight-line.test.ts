import {it,expect} from 'vitest';
import {straightLinePoints} from './straight-line';
import {normalizePoint,rotatePoint,hitStroke,applyChange,type Rotation,type Point} from './geometry';
import type {Stroke} from '../../db/models';
it('途中のドラッグ位置を残さず始点・終点だけで一定幅の直線にする',()=>{
  const a:Point=[.1,.2,.1],b:Point=[.8,.9,.9];const points=straightLinePoints(a,b,600,800);expect(points).toEqual([[.1,.2,.5],[.8,.9,.5]]);expect(a).toEqual([.1,.2,.1]);expect(b).toEqual([.8,.9,.9]);
});
it('Shiftで見た目の距離が近い水平・垂直に固定し、ページの縦横比も考慮する',()=>{
  expect(straightLinePoints([.1,.1,.5],[.5,.3,.5],600,800,true)[1]).toEqual([.5,.1,.5]);
  expect(straightLinePoints([.1,.1,.5],[.4,.4,.5],600,1000,true)[1]).toEqual([.1,.4,.5]);
  expect(straightLinePoints([.1,.1,.5],[.4,.4,.5],1000,600,true)[1]).toEqual([.4,.1,.5]);
});
it('全回転と拡大でも始点・終点が正しいページ座標に保存される',()=>{
  const a:Point=[.2,.3,.5],b:Point=[.7,.8,.5];for(const r of [0,90,180,270] as Rotation[]){const normalize=(p:Point)=>{const displayed=rotatePoint(p,r);return normalizePoint(30+displayed[0]*1200,40+displayed[1]*900,{left:30,top:40,width:1200,height:900},.5,r);};const points=straightLinePoints(normalize(a),normalize(b),r===90||r===270?900:1200,r===90||r===270?1200:900);for(const [index,p]of [a,b].entries()){expect(points[index][0]).toBeCloseTo(p[0]);expect(points[index][1]).toBeCloseTo(p[1]);}}
});
it('既存形式のペンとしてUndo/Redoと線分の消去を利用できる',()=>{
  const line:Stroke={id:'line',pdfDocId:'pdf',pageIndex:0,tool:'pen',color:'#2563eb',width:.004,points:straightLinePoints([.1,.2,.5],[.9,.2,.5],600,800)};
  const change={added:[line],removed:[]};expect(hitStroke(line,[.5,.2,.5],600,800,8)).toBe(true);expect(hitStroke(line,[.5,.5,.5],600,800,8)).toBe(false);expect(applyChange([line],change,true)).toEqual([]);expect(applyChange([],change)).toEqual([line]);
});
