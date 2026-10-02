import {it,expect} from 'vitest';
import {transformTextBox,wheelZoom} from './text-box-geometry';
const box={id:'t',pdfDocId:'p',pageIndex:0,x:.2,y:.3,width:.4,height:.2,text:'メモ',color:'#000',fontSize:.03};
it('枠をページ内に移動し、文字サイズを維持する',()=>{expect(transformTextBox(box,2,-2)).toMatchObject({x:.6,y:0,fontSize:.03});});
it('四隅で反対側を固定してリサイズする',()=>{
  expect(transformTextBox(box,.1,.1,'se')).toMatchObject({x:.2,y:.3,width:.5});
  const nw=transformTextBox(box,.1,.1,'nw');expect(nw.x+nw.width).toBeCloseTo(.6);expect(nw.y+nw.height).toBeCloseTo(.5);
  const ne=transformTextBox(box,.1,.1,'ne');expect(ne.x).toBe(.2);expect(ne.y+ne.height).toBeCloseTo(.5);
  const sw=transformTextBox(box,.1,.1,'sw');expect(sw.x+sw.width).toBeCloseTo(.6);expect(sw.y).toBe(.3);
  expect(transformTextBox(box,9,9,'nw').width).toBeCloseTo(.08);
});
it('トラックパッドのピンチ量を連続した倍率に変換する',()=>{expect(wheelZoom(1,-10,0)).toBeGreaterThan(1);expect(wheelZoom(1,10,0)).toBeLessThan(1);expect(wheelZoom(1,-10000,0)).toBe(3);expect(wheelZoom(1,10000,0)).toBe(.5);});
