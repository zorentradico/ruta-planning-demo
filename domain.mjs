export const ZONE='Europe/Madrid';
export const MINUTE=60000;
export const TYPES={drive:'Conducción',work:'Otros trabajos',break:'Pausa',availability:'Disponibilidad'};
const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function local(instant){const p=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
export function instant(value){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Fecha y hora no válidas.');
 const nominal=Date.parse(value+'Z');if(!Number.isFinite(nominal))throw Error('Fecha no válida.');
 let guess=nominal;for(let i=0;i<4;i++){const projected=Date.parse(local(guess)+'Z');guess+=nominal-projected;}
 const matches=[guess-3600000,guess,guess+3600000].filter(t=>local(t)===value);
 if(matches.length!==1)throw Error('Hora inexistente o ambigua por el cambio de hora de Madrid. Elige otra hora.');
 return new Date(matches[0]).toISOString();
}
export function addDays(day,n){return new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);}
export function monday(day){const dow=new Date(day+'T12:00Z').getUTCDay();return addDays(day,-((dow+6)%7));}
export function duration(a,b){return (Date.parse(b)-Date.parse(a))/MINUTE;}
export function fmt(minutes){const m=Math.round(minutes);return `${Math.floor(m/60)} h${m%60?' '+String(m%60).padStart(2,'0')+' min':''}`;}
export function layout(s){let cursor=0;return s.activities.map((a,index)=>{const offset=a.offset??cursor;cursor=offset+a.minutes;return {...a,index,offset,start:new Date(Date.parse(s.start)+offset*MINUTE).toISOString(),end:new Date(Date.parse(s.start)+cursor*MINUTE).toISOString()};});}
export function endOf(s){return new Date(Math.max(...layout(s).map(a=>Date.parse(a.end)))).toISOString();}
export function normalizeService(s){const acts=layout(s),first=Math.min(...acts.map(a=>a.offset));return {...s,start:new Date(Date.parse(s.start)+first*MINUTE).toISOString(),activities:acts.map(({type,minutes,offset})=>({type,minutes,offset:offset-first}))};}
export function driving(s){return s.activities.filter(a=>a.type==='drive').reduce((n,a)=>n+a.minutes,0);}
export function overlap(a,b){return Date.parse(a.start)<Date.parse(b.end)&&Date.parse(b.start)<Date.parse(a.end);}
export function activitiesOf(services){return services.flatMap(s=>layout(s).map(a=>({...a,driverId:s.driverId,truckId:s.truckId,serviceId:s.id,id:s.id+'-'+a.index})));}
// Only touching intervals are linked. Midnight does not split a duty; daily/weekly rest does.
export function editInterval(state,target,delta,resize=false,linked=false){
 if(!Number.isInteger(delta))throw Error('Desplazamiento no válido.');
 const next=structuredClone(state),service=next.services.find(s=>s.id===target.serviceId),rest=next.rests.find(r=>r.id===target.restId);
 const selected=rest?{...rest,restId:rest.id}:service?{...layout(service)[target.index],serviceId:service.id,driverId:service.driverId}:null;
 if(!selected||!selected.start)throw Error('Tramo no encontrado.');
 if(resize){if(rest){rest.end=new Date(Date.parse(rest.end)+delta*MINUTE).toISOString();if(duration(rest.start,rest.end)<1)throw Error('El descanso debe durar al menos un minuto.');}
 else{service.activities=layout(service).map(a=>({type:a.type,minutes:a.minutes+(a.index===target.index?delta:0),offset:a.offset}));if(service.activities.some(a=>a.minutes<1||a.minutes>1440))throw Error('Cada tramo debe durar entre 1 y 1440 minutos.');}return validateState(next);}
 let members=[selected];
 if(linked&&(!rest||duration(rest.start,rest.end)<540)){
  const candidates=[...activitiesOf(next.services.filter(s=>s.driverId===selected.driverId)),...next.rests.filter(r=>r.driverId===selected.driverId&&duration(r.start,r.end)<540).map(r=>({...r,restId:r.id}))];
  let begin=Date.parse(selected.start),end=Date.parse(selected.end),changed=true;
  while(changed){changed=false;for(const a of candidates){const lo=Date.parse(a.start),hi=Date.parse(a.end);if(lo<=end&&hi>=begin&&(lo<begin||hi>end)){begin=Math.min(begin,lo);end=Math.max(end,hi);changed=true;}}}
  members=candidates.filter(a=>Date.parse(a.start)<=end&&Date.parse(a.end)>=begin);
 }
 for(const s of next.services){const indexes=new Set(members.filter(a=>a.serviceId===s.id).map(a=>a.index));if(!indexes.size)continue;s.activities=layout(s).map(a=>({type:a.type,minutes:a.minutes,offset:a.offset+(indexes.has(a.index)?delta:0)}));Object.assign(s,normalizeService(s));}
 for(const r of next.rests)if(members.some(a=>a.restId===r.id)){r.start=new Date(Date.parse(r.start)+delta*MINUTE).toISOString();r.end=new Date(Date.parse(r.end)+delta*MINUTE).toISOString();}
 return validateState(next);
}
export function weekMinutes(state,driverId,week){
 const start=Date.parse(instant(week+'T00:00')),end=Date.parse(instant(addDays(week,7)+'T00:00'));
 const summary=state.baselines.find(b=>b.driverId===driverId&&b.week===week);
 return (summary?.minutes||0)+activitiesOf(state.services.filter(s=>s.driverId===driverId)).filter(a=>a.type==='drive').reduce((n,a)=>n+Math.max(0,Math.min(Date.parse(a.end),end)-Math.max(Date.parse(a.start),start))/MINUTE,0);
}
export function template(minutes){
 const result=[{type:'work',minutes:30}];let left=minutes;
 while(left>0){const chunk=Math.min(left,270);result.push({type:'drive',minutes:chunk});left-=chunk;if(left>0)result.push({type:'break',minutes:45});}
 result.push({type:'work',minutes:30});return result;
}
export function adjustService(service,deltaMinutes,truckId,resize=false){
 if(!Number.isFinite(deltaMinutes))throw Error('Desplazamiento no válido.');
 const next=structuredClone(service);
 if(resize){const index=next.activities.findLastIndex(a=>a.type==='drive');if(index<0)throw Error('Este servicio no contiene conducción que ampliar.');next.activities[index].minutes+=deltaMinutes;if(next.activities[index].minutes<15||next.activities[index].minutes>1440)throw Error('El último tramo debe quedar entre 15 y 1440 minutos.');}
 else{next.start=new Date(Date.parse(next.start)+deltaMinutes*MINUTE).toISOString();next.truckId=truckId;}
 return next;
}
export function validateState(state){
 if(!state||state.version!==1||!Array.isArray(state.drivers)||state.drivers.length!==5||!Array.isArray(state.trucks)||state.trucks.length!==4||!Array.isArray(state.services)||state.services.length>500||!Array.isArray(state.rests)||state.rests.length>1000||!Array.isArray(state.baselines)||state.baselines.length>200)throw Error('Archivo de demo no compatible.');
 const ids=new Set();const text=(v,max=160)=>typeof v==='string'&&v.length>0&&v.length<=max;
 const validId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v);
 for(const d of state.drivers){if(!validId(d.id)||!text(d.name,60)||!text(d.base,60)||!text(d.residence,40))throw Error('Conductor no válido.');}
 for(const t of state.trucks){if(!validId(t.id)||!text(t.name,60)||!text(t.plate,30)||!text(t.description,80))throw Error('Camión no válido.');}
 if(new Set(state.drivers.map(x=>x.id)).size!==5||new Set(state.trucks.map(x=>x.id)).size!==4)throw Error('Identificadores duplicados.');
 const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v));
 for(const s of state.services){
  if(!validId(s.id)||ids.has(s.id)||!state.drivers.some(d=>d.id===s.driverId)||!state.trucks.some(t=>t.id===s.truckId)||!text(s.route)||!validDate(s.start)||!Array.isArray(s.activities)||s.activities.length<1||s.activities.length>50||!s.activities.every(a=>Object.hasOwn(TYPES,a.type)&&Number.isInteger(a.minutes)&&a.minutes>=1&&a.minutes<=1440&&(a.offset===undefined||(Number.isInteger(a.offset)&&a.offset>=0&&a.offset<=4320)))||s.activities.reduce((n,a)=>n+a.minutes,0)>4320||duration(s.start,endOf(s))>4320)throw Error('Servicio no válido.');ids.add(s.id);
 }
 for(const r of state.rests){if(!validId(r.id)||ids.has(r.id)||!state.drivers.some(d=>d.id===r.driverId)||!validDate(r.start)||!validDate(r.end)||duration(r.start,r.end)<=0||duration(r.start,r.end)>20160||!['daily','weekly'].includes(r.kind)||!text(r.country,40)||!['hotel','home','cab','unknown'].includes(r.accommodation))throw Error('Descanso no válido.');ids.add(r.id);}
 for(const b of state.baselines){if(!state.drivers.some(d=>d.id===b.driverId)||!/^\d{4}-\d{2}-\d{2}$/.test(b.week)||monday(b.week)!==b.week||!Number.isFinite(b.minutes)||b.minutes<0||b.minutes>10080)throw Error('Histórico no válido.');}
 if(new Set(state.baselines.map(b=>b.driverId+b.week)).size!==state.baselines.length)throw Error('Histórico duplicado.');
 for(const b of state.baselines){if(activitiesOf(state.services.filter(s=>s.driverId===b.driverId)).some(a=>a.type==='drive'&&overlap(a,{start:instant(b.week+'T00:00'),end:instant(addDays(b.week,7)+'T00:00')})))throw Error('El resumen histórico y las actividades se solapan.');}
 return state;
}
export function analyse(state,referenceDay){
 const issues=[],obligations=[];const now=Date.parse(instant(referenceDay+'T00:00'));
 const push=(code,severity,driverId,title,detail,serviceIds=[],when=null)=>issues.push({id:[code,driverId,...serviceIds,when||''].join(':'),code,severity,driverId,title,detail,serviceIds,when});
 const services=state.services.map(s=>({...s,end:endOf(s)}));
 for(const s of services){const acts=layout(s).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));let end=Date.parse(s.start);
  for(let i=0;i<acts.length;i++){const a=acts[i];if(Date.parse(a.start)>end)push('activity-gap','unknown',s.driverId,'Hueco sin actividad declarada','El intervalo vacío no se considera descanso. Completa o revisa la jornada.',[s.id],a.start);if(i&&Date.parse(a.start)<end)push('activity-overlap','error',s.driverId,'Actividades del servicio solapadas','Dos tramos de la misma jornada coinciden. Ajusta sus horas o duraciones.',[s.id],a.start);end=Math.max(end,Date.parse(a.end));}
 }
 for(let i=0;i<services.length;i++)for(let j=i+1;j<services.length;j++){const a=services[i],b=services[j];if(!overlap(a,b))continue;
  if(a.driverId===b.driverId)push('driver-overlap','error',a.driverId,'Conductor asignado a la vez',`${a.route} coincide con ${b.route}.`,[a.id,b.id],a.start);
  if(a.truckId===b.truckId)push('truck-overlap','error',a.driverId,'Camión ocupado por dos servicios',`${state.trucks.find(t=>t.id===a.truckId).plate}: hay una doble reserva.`,[a.id,b.id],a.start);
 }
 for(const r of state.rests){
  const colliding=services.filter(s=>s.driverId===r.driverId&&overlap(s,r));
  if(colliding.length)push('rest-overlap','error',r.driverId,'Servicio durante un descanso declarado','Ajusta el servicio o corrige el descanso. Este descanso no reinicia los contadores mientras esté solapado.',colliding.map(s=>s.id),r.start);
 }
 for(const driver of state.drivers){
  const ds=services.filter(s=>s.driverId===driver.id).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  const rs=state.rests.filter(r=>r.driverId===driver.id).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  const usable=rs.filter(r=>!ds.some(s=>overlap(s,r))&&!rs.some(other=>other.id!==r.id&&overlap(r,other)));
  for(let i=1;i<rs.length;i++)if(overlap(rs[i-1],rs[i]))push('rests-overlap','warning',driver.id,'Descansos declarados solapados','Revisa sus fechas; no se usan como reinicio fiable.',[],rs[i].start);
  const acts=activitiesOf(ds).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  const normalRests=usable.filter(r=>duration(r.start,r.end)>=540);
 const cycles=new Map(),effectiveDaily=new Map();
  for(const a of acts.filter(x=>x.type==='drive')){
   const before=normalRests.filter(r=>Date.parse(r.end)<=Date.parse(a.start)).at(-1);
   if(!before){push('missing-rest','unknown',driver.id,'Falta el descanso anterior','No se puede verificar el periodo diario de conducción.',[a.serviceId],a.start);continue;}
   const key=before.id;if(!cycles.has(key))cycles.set(key,{rest:before,minutes:0,serviceIds:new Set(),start:a.start});
   const c=cycles.get(key);c.minutes+=a.minutes;c.serviceIds.add(a.serviceId);
  }
  const extensions=new Map();
  for(const c of cycles.values()){
   const ids=[...c.serviceIds];if(c.minutes>600)push('daily-drive','error',driver.id,`${fmt(c.minutes)} en un periodo de conducción`,'Supera el máximo ampliado de 10 h desde el último descanso declarado válido.',ids,c.start);
   if(c.minutes>540){const week=monday(local(c.start).slice(0,10));if(!extensions.has(week))extensions.set(week,[]);extensions.get(week).push(c);}
   const next=normalRests.find(r=>Date.parse(r.start)>=Date.parse(c.rest.end)&&r.id!==c.rest.id);
   const firstActivity=acts.find(a=>Date.parse(a.start)>=Date.parse(c.rest.end));
   if(next&&firstActivity){const available=Math.min(duration(next.start,next.end),(Date.parse(c.rest.end)+24*3600000-Date.parse(next.start))/MINUTE);effectiveDaily.set(next.id,available);
    if(available<540)push('daily-window','error',driver.id,'Descanso insuficiente dentro de las 24 h','El descanso declarado no completa 9 h dentro de la ventana iniciada al finalizar el anterior. El fraccionado 3 + 9 h requiere revisión.',ids,next.start);
   }else if(firstActivity)push('next-rest','unknown',driver.id,'Falta el siguiente descanso','Declara cuándo comienza y termina el descanso para comprobar la ventana diaria.',ids,c.start);
  }
  for(const [week,list] of extensions)if(list.length>2)push('third-extension','error',driver.id,'Más de dos ampliaciones a 10 h',`${list.length} periodos superan 9 h en la semana del ${week}.`,list.flatMap(c=>[...c.serviceIds]),instant(week+'T00:00'));
  // Only declared pauses reset the accumulated driving. Unknown gaps and other work never do.
  let accumulated=0,partial=false,previousEnd=null,reported=false;
  for(const a of acts){
   if(previousEnd&&normalRests.some(r=>Date.parse(r.start)>=previousEnd&&Date.parse(r.end)<=Date.parse(a.start))){accumulated=0;partial=false;reported=false;}
   if(a.type==='drive'){accumulated+=a.minutes;if(accumulated>270&&!reported){push('driving-break','error',driver.id,'Conducción sin pausa suficiente',`${fmt(accumulated)} acumuladas. Se requiere una pausa válida de 45 min o la secuencia 15 + 30 min.`,[a.serviceId],a.start);reported=true;}}
   if(a.type==='break'&&!acts.some(other=>other.id!==a.id&&overlap(a,other))){if(a.minutes>=45||(partial&&a.minutes>=30)){accumulated=0;partial=false;reported=false;}else if(a.minutes>=15)partial=true;}
   previousEnd=Date.parse(a.end);
  }
  const weeks=new Set([monday(referenceDay),...acts.map(a=>monday(local(a.start).slice(0,10))),...acts.map(a=>monday(local(a.end).slice(0,10)))]);
  for(const w of [...weeks])weeks.add(addDays(w,7));
  for(const w of weeks){const mins=weekMinutes(state,driver.id,w),prev=weekMinutes(state,driver.id,addDays(w,-7));const ids=ds.filter(s=>overlap(s,{start:instant(addDays(w,-7)+'T00:00'),end:instant(addDays(w,7)+'T00:00')})).map(s=>s.id);
   if(mins>3360)push('weekly-drive','error',driver.id,'Más de 56 h en una semana',`${fmt(mins)} en la semana del ${w}.`,ids,instant(w+'T00:00'));
   if(mins+prev>5400)push('fortnight-drive','error',driver.id,'Más de 90 h en dos semanas',`${fmt(prev)} + ${fmt(mins)} = ${fmt(prev+mins)}. Par de semanas: ${addDays(w,-7)} / ${w}.`,ids,instant(w+'T00:00'));
  }
  const weekly=usable.filter(r=>r.kind==='weekly');let reducedDaily=0;
  for(const r of usable){const mins=effectiveDaily.get(r.id)??duration(r.start,r.end);
   if(r.kind==='weekly'&&mins>=1440)reducedDaily=0;
   else if(r.kind==='daily'&&mins>=540&&mins<660){reducedDaily++;if(reducedDaily>3)push('daily-reductions','error',driver.id,'Más de tres descansos diarios reducidos','Se cuentan entre los descansos semanales declarados.',[],r.start);}
   if(r.kind==='daily'&&mins<540)push('short-daily-rest','error',driver.id,'Descanso diario inferior a 9 h','El descanso declarado es insuficiente para el perfil individual de la demo.',[],r.start);
  }
  for(let i=0;i<weekly.length;i++){
   const r=weekly[i],mins=duration(r.start,r.end);
   if(mins<1440)push('short-weekly-rest','error',driver.id,'Descanso semanal inferior a 24 h',`Duración declarada: ${fmt(mins)}.`,[],r.start);
   if(mins>=2700&&r.accommodation==='cab')push('weekly-cabin','error',driver.id,'Descanso semanal normal en cabina','El descanso semanal normal debe realizarse fuera del vehículo.',[],r.start);
   if(mins>=2700&&r.accommodation==='unknown')push('accommodation','unknown',driver.id,'Alojamiento sin confirmar','Indica alojamiento para el descanso semanal normal.',[],r.start);
   if(mins>=1440&&mins<2700){const week=monday(local(r.start).slice(0,10));const deadline=instant(addDays(week,28)+'T00:00');obligations.push({id:r.id,driverId:driver.id,type:'compensation',minutes:2700-mins,deadline,description:'Compensación por descanso de '+fmt(mins)+'. Pendiente de vincular y revisar.',status:Date.parse(deadline)<now?'Vencimiento pasado':'Pendiente de revisión'});
    if(weekly[i-1]&&duration(weekly[i-1].start,weekly[i-1].end)<2700)push('international-reduced','unknown',driver.id,'Dos descansos semanales reducidos consecutivos','Revisar países, cuatro semanas, compensación conjunta previa y organización del regreso. La demo no valida esta excepción internacional.',[],r.start);
   }
   const next=weekly[i+1];if(next&&Date.parse(next.start)>Date.parse(r.end)+144*3600000)push('weekly-window','error',driver.id,'Descanso semanal después de 6 × 24 h','Hay más de 144 h entre el final de un descanso semanal y el inicio del siguiente declarado.',[],next.start);
  }
  if(ds.length&&!weekly.length)push('weekly-missing','unknown',driver.id,'Falta historial semanal','No se pueden verificar los descansos y compensaciones.',[],ds[0].start);
 }
 const unique=[...new Map(issues.map(i=>[i.id,i])).values()];
 const priority={error:0,warning:1,unknown:2};unique.sort((a,b)=>priority[a.severity]-priority[b.severity]);return {issues:unique,obligations};
}
