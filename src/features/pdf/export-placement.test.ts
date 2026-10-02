import {it,expect} from 'vitest';
import {PDFDocument,degrees} from 'pdf-lib';
import {annotationPlacement} from './export-placement';
it('回転とCropBoxに合わせて注釈を配置する',async()=>{
  const pdf=await PDFDocument.create(),page=pdf.addPage([700,900]);page.setCropBox(20,30,595,842);
  const expected=[{x:20,y:30,width:595,height:842},{x:615,y:30,width:842,height:595},{x:615,y:872,width:595,height:842},{x:20,y:872,width:842,height:595}];
  for(const[r,index]of [0,90,180,270].map((r,i)=>[r,i])){page.setRotation(degrees(r));expect(annotationPlacement(page)).toMatchObject(expected[index]);expect(annotationPlacement(page).rotate.angle).toBe(r);}
});
