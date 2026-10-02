import {db,type StudyDatabase} from '../../db/database';
import type {Stroke,TextBox,TextNote} from '../../db/models';
const writers=new Set<{flush:()=>Promise<void>}>();
export async function flushAllStrokes(){await Promise.all([...writers].map(w=>w.flush()));}
export class AnnotationWriter<T extends Stroke|TextBox|TextNote> {
  private pending=new Map<string,T|null>();private timer:ReturnType<typeof setTimeout>|undefined;private running:Promise<void>|undefined;
  constructor(private notify:(state:'saving'|'saved'|'error')=>void,private database:StudyDatabase=db,private table:import('dexie').Table<T,string>=database.strokes as unknown as import('dexie').Table<T,string>){}
  queue(stroke:T|null,id=stroke?.id){if(!id)return;writers.add(this);this.pending.set(id,stroke);this.notify('saving');clearTimeout(this.timer);this.timer=setTimeout(()=>{void this.flush().catch(()=>{});},250);}
  async flush():Promise<void>{
    clearTimeout(this.timer);if(this.running){await this.running;if(this.pending.size)await this.flush();return;}
    if(!this.pending.size)return;
    const batch=new Map(this.pending);this.pending.clear();
    this.running=this.database.transaction('rw',this.table,async()=>{
      await this.table.bulkPut([...batch.values()].filter((s):s is T=>s!==null));
      await this.table.bulkDelete([...batch].filter(([,s])=>s===null).map(([id])=>id));
    }).then(()=>{if(!this.pending.size)this.notify('saved');}).catch((error:unknown)=>{for(const[id,s]of batch)if(!this.pending.has(id))this.pending.set(id,s);this.notify('error');throw error;}).finally(()=>{this.running=undefined;});
    await this.running;if(this.pending.size)await this.flush();
  }
  dispose(){clearTimeout(this.timer);void this.flush().then(()=>writers.delete(this)).catch(()=>{});}
}

export class StrokeWriter extends AnnotationWriter<Stroke> {}
export class TextBoxWriter extends AnnotationWriter<TextBox> {constructor(notify:(state:'saving'|'saved'|'error')=>void,database:StudyDatabase=db){super(notify,database,database.textBoxes as unknown as import('dexie').Table<TextBox,string>);}}

export async function persistStrokeChange(writer:StrokeWriter,change:import('./geometry').Change,inverse=false){
  const put=inverse?change.removed:change.added,remove=inverse?change.added:change.removed;
  const replaced=new Set(put.map(s=>s.id));for(const s of remove)if(!replaced.has(s.id))writer.queue(null,s.id);for(const s of put)writer.queue(s);await writer.flush();
}

export class TextNoteWriter extends AnnotationWriter<TextNote> {constructor(notify:(state:'saving'|'saved'|'error')=>void,database:StudyDatabase=db){super(notify,database,database.textNotes as unknown as import('dexie').Table<TextNote,string>);}}
