import {expect,it} from 'vitest';
import {isTwoFingerTap,movedFrom} from './fullscreen-gesture';
it('短い静止タップのみ案内を表示し、長押し・移動・キャンセルを除外する',()=>{expect(isTwoFingerTap(200,false)).toBe(true);expect(isTwoFingerTap(450,false)).toBe(false);expect(isTwoFingerTap(200,true)).toBe(false);expect(isTwoFingerTap(200,false,true)).toBe(false);expect(movedFrom({x:0,y:0},4,4)).toBe(false);expect(movedFrom({x:0,y:0},13,0)).toBe(true);});
