import {it,expect} from 'vitest';
import {lassoSelect,moveStrokes} from './lasso-geometry';
import type {Stroke} from '../../db/models';
import type {Point} from './geometry';
const stroke:Stroke={id:'s',pdfDocId:'p',pageIndex:0,tool:'pen',color:'#000',width:.003,points:[[.2,.3,.7],[.4,.5,.8]]};
const polygon:Point[]=[[.1,.1,.5],[.6,.1,.5],[.6,.6,.5],[.1,.6,.5]];
it('囲んだ線と囲みを横断する線を選択し、離れた線を除外する',()=>{
  const crossing={...stroke,id:'crossing',points:[[0,.3,.5],[1,.3,.5]] as Point[]},outside={...stroke,id:'out',points:[[.8,.8,.5]] as Point[]};
  expect(lassoSelect([stroke,crossing,outside],polygon).map(s=>s.id)).toEqual(['s','crossing']);expect(lassoSelect([stroke],polygon.slice(0,2))).toEqual([]);
});
it('選択全体の形と筆圧を維持してページ内に移動する',()=>{const[next]=moveStrokes([stroke],1,-1);expect(next.points[0][0]).toBeCloseTo(.8);expect(next.points[1][0]).toBe(1);expect(next.points[0][1]).toBe(0);expect(next.points[1][1]).toBeCloseTo(.2);expect(next.points[0][2]).toBe(.7);expect(stroke.points[0][0]).toBe(.2);});
