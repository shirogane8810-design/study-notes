import {describe,it,expect} from 'vitest';
import {normalizePoint,rotatePoint,pressureWidth,hitStroke,applyChange,visiblePages,type Point,type Rotation} from './geometry';
import type {Stroke} from '../../db/models';
const stroke:Stroke={id:'a',pdfDocId:'pdf',pageIndex:0,tool:'pen',color:'#000',width:.003,points:[[.1,.2,.5],[.9,.2,.5]]};
describe('手書きの座標と編集',()=>{
  it('拡大表示と全回転で元の正規化座標に戻る',()=>{for(const r of [0,90,180,270] as Rotation[]){const original:Point=[.23,.68,.7];const displayed=rotatePoint(original,r);const p=normalizePoint(20+displayed[0]*1200,30+displayed[1]*900,{left:20,top:30,width:1200,height:900},.7,r);expect(p[0]).toBeCloseTo(original[0]);expect(p[1]).toBeCloseTo(original[1]);}});
  it('点間の線分でも消しゴムが当たり、遠い場所では消さない',()=>{expect(hitStroke(stroke,[.5,.2,.5],600,800,8)).toBe(true);expect(hitStroke(stroke,[.5,.5,.5],600,800,8)).toBe(false);});
  it('筆圧でペン幅が変わり、蛍光ペンは一定幅になる',()=>{expect(pressureWidth(2,.9,'pen')).toBeGreaterThan(pressureWidth(2,.1,'pen'));expect(pressureWidth(12,.1,'highlighter')).toBe(12);});
  it('消去と追加をUndo/Redoで往復できる',()=>{const b={...stroke,id:'b'};const change={added:[b],removed:[stroke]};const result=applyChange([stroke],change);expect(result).toEqual([b]);expect(applyChange(result,change,true)).toEqual([stroke]);});
  it('100ページでも表示範囲の前後だけを返す',()=>{const range=visiblePages(Array.from({length:100},(_,i)=>i*1020),Array(100).fill(1000),50000,900);expect(range.end-range.start).toBeLessThanOrEqual(4);expect(range.start).toBeGreaterThan(40);});
});
