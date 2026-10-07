export const materialAccept='application/pdf,.pdf,image/png,.png,image/jpeg,.jpg,.jpeg,image/webp,.webp';

export function imageFormat(bytes:Uint8Array):'png'|'jpeg'|'webp'|undefined{
  if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'png';
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpeg';
  if(bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&bytes[8]===87&&bytes[9]===69&&bytes[10]===66&&bytes[11]===80)return 'webp';
}

export function imagePageSize(width:number,height:number){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('画像の大きさを取得できませんでした。');
  const scale=842/Math.max(width,height);
  return {width:width*scale,height:height*scale};
}

export async function imagePdf(png:Uint8Array,width:number,height:number){
  const {PDFDocument}=await import('pdf-lib');
  const pdf=await PDFDocument.create(),size=imagePageSize(width,height),image=await pdf.embedPng(png);
  pdf.addPage([size.width,size.height]).drawImage(image,{x:0,y:0,...size});
  return new Blob([new Uint8Array(await pdf.save())],{type:'application/pdf'});
}

/** Decode locally to honor photo orientation and normalize WebP/transparency. */
export async function imageToPdf(file:File){
  const url=URL.createObjectURL(file),image=new Image();
  try{
    image.src=url;
    try{await image.decode();}catch{throw new Error('画像を開けません。破損していないPNG・JPEG・WebPを選んでください。');}
    const width=image.naturalWidth,height=image.naturalHeight;imagePageSize(width,height);
    const scale=Math.min(1,4096/Math.max(width,height)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('画像を読み込めませんでした。');
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('画像を変換できませんでした。')),'image/png'));
    return await imagePdf(new Uint8Array(await png.arrayBuffer()),width,height);
  }finally{URL.revokeObjectURL(url);}
}
