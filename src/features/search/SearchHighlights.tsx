import type {PdfDoc} from '../../db/models';
import {rotatePoint,type Rotation} from '../pdf/geometry';
import {matchingRuns} from './search';
export function SearchHighlights({doc,index,query,rotation}:{doc:PdfDoc;index:number;query:string;rotation:Rotation}){
  const page=doc.pages[index];if(page.kind!=='pdf')return null;const runs=matchingRuns(doc.extractedText.find(t=>t.page===page.srcPage)?.runs??[],query);
  return <svg className="search-highlights" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label={`検索語句のハイライト ${runs.length}か所`}>{runs.map((r,i)=>{const[x,y,w,h]=r.rect;return <polygon key={i} points={[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([a,b])=>{const p=rotatePoint([a,b,1],rotation);return `${p[0]*1000},${p[1]*1000}`;}).join(' ')} fill="#fbbf24" fillOpacity=".4" stroke="#d97706" strokeWidth="1"/>;})}</svg>;
}
