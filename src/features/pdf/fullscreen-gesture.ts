export function isTwoFingerTap(duration:number,moved:boolean,cancelled=false){return duration>=0&&duration<450&&!moved&&!cancelled;}
export function movedFrom(start:{x:number;y:number},x:number,y:number){return Math.hypot(start.x-x,start.y-y)>12;}
