import {degrees,type PDFPage} from 'pdf-lib';
export function annotationPlacement(page:Pick<PDFPage,'getRotation'|'getCropBox'>){
  const r=((page.getRotation().angle%360)+360)%360,{x,y,width:w,height:h}=page.getCropBox();
  return {x:r===90||r===180?x+w:x,y:r===180||r===270?y+h:y,width:r===90||r===270?h:w,height:r===90||r===270?w:h,rotate:degrees(r)};
}
