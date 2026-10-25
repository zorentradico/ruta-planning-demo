import {instant,addDays,endOf,template} from './domain.mjs';
export function createDemo(){
 const drivers=[{id:'ana',name:'Mikhail',base:'Valencia',residence:'España',initials:'MI',color:'#176e77'},{id:'luis',name:'Yuri',base:'Madrid',residence:'España',initials:'YU',color:'#8c5a33'},{id:'marta',name:'Sandu',base:'Barcelona',residence:'España',initials:'SA',color:'#7056a3'},{id:'david',name:'Gavrile',base:'Zaragoza',residence:'España',initials:'GA',color:'#3e6fa3'},{id:'elena',name:'Conductor 5',base:'Valencia',residence:'España',initials:'C5',color:'#9d5267'}];
 const trucks=[{id:'t1',name:'DAF XF',plate:'DEMO-01',description:'Frigorífico · 40 t'},{id:'t2',name:'DAF XG',plate:'DEMO-02',description:'Lona · 40 t'},{id:'t3',name:'DAF XG+',plate:'DEMO-03',description:'Lona · 40 t'},{id:'t4',name:'DAF CF',plate:'DEMO-04',description:'Frigorífico · 40 t'}];
 const hours=[[8,9,8,8,6],[10,10,9,10,5],[7,8,9,8,6],[8.75,8,8,9,5],[3,3,3,3,3]];
 const times=[['06:00','06:00','07:00','06:00','06:00'],['06:00','07:00','07:00','07:00','07:00'],['07:00','07:00','07:00','08:00','07:00'],['05:00','06:00','06:00','06:00','06:00'],['17:00','18:00','18:00','17:00','16:00']];
 const routes=[['Valencia → Lyon','Lyon → Milán','Milán → Lyon','Lyon → Barcelona','Barcelona → Valencia'],['Madrid → Burdeos','Burdeos → París','París → Colonia','Colonia → Lyon','Lyon → Burdeos'],['Barcelona → Marsella','Marsella → Turín','Turín → Zúrich','Zúrich → Lyon','Lyon → Barcelona'],['Zaragoza → Toulouse','Toulouse → Nantes','Nantes → Burdeos','Burdeos → Zaragoza','Zaragoza → Madrid'],['Valencia → Teruel','Milán · distribución','Lyon · distribución','Barcelona · reparto','Valencia · reparto']];
 const services=[],rests=[];
 drivers.forEach((d,i)=>{
  for(let j=0;j<5;j++){const day=addDays('2026-10-26',j);services.push({id:`s-${d.id}-${j}`,driverId:d.id,truckId:'t'+(i===4?1:i+1),route:routes[i][j],start:instant(day+'T'+times[i][j]),activities:template(hours[i][j]*60)});}
  const own=services.filter(s=>s.driverId===d.id);
  rests.push({id:'r-before-'+d.id,driverId:d.id,start:instant('2026-10-23T08:00'),end:own[0].start,kind:'weekly',country:'España',accommodation:'home'});
  for(let j=0;j<own.length;j++)rests.push({id:`r-${d.id}-${j}`,driverId:d.id,start:endOf(own[j]),end:j<4?own[j+1].start:instant('2026-11-02T07:00'),kind:j===4?'weekly':'daily',country:i===1?'Francia':'España',accommodation:j===4?'hotel':'cab'});
 });
 // Explicit fictional edge case for the international review workflow.
 const rb=rests.find(r=>r.id==='r-before-luis');rb.start=instant('2026-10-24T06:00');rb.end=instant('2026-10-25T06:00');rb.country='Alemania';rb.accommodation='cab';
 rests.push({id:'r-international-luis',driverId:'luis',start:instant('2026-10-17T06:00'),end:instant('2026-10-18T06:00'),kind:'weekly',country:'Francia',accommodation:'cab'});
 rests.push({id:'r-sunday-luis',driverId:'luis',start:instant('2026-10-25T19:00'),end:instant('2026-10-26T06:00'),kind:'daily',country:'Alemania',accommodation:'cab'});
 return {version:1,drivers,trucks,services,rests,baselines:drivers.map((d,i)=>({driverId:d.id,week:'2026-10-19',minutes:[38,49,34,42,36][i]*60}))};
}
