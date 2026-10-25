import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemo} from '../seed.mjs';
import {instant,local,duration,template,analyse,validateState,weekMinutes,endOf,adjustService,driving} from '../domain.mjs';
const at=s=>instant(s);
function fixture(){const s=createDemo();s.services=[];s.rests=[{id:'before',driverId:'ana',start:at('2026-10-23T08:00'),end:at('2026-10-26T06:00'),kind:'weekly',country:'España',accommodation:'home'},{id:'after',driverId:'ana',start:at('2026-10-26T19:00'),end:at('2026-10-27T06:00'),kind:'daily',country:'Francia',accommodation:'cab'}];s.baselines=[];return s;}
function service(activities=template(480),overrides={}){return {id:'test-service',truckId:'t1',driverId:'ana',route:'Ruta ficticia',start:at('2026-10-26T06:00'),activities,...overrides};}
function codes(s){return analyse(s,'2026-10-26').issues.map(i=>i.code);}
test('seed schema and five fictional drivers',()=>{const s=createDemo();assert.equal(validateState(s),s);assert.equal(s.drivers.length,5);assert.equal(s.trucks.length,4);});
test('winter time is Madrid regardless of computer timezone',()=>{assert.equal(at('2026-10-26T06:00'),'2026-10-26T05:00:00.000Z');assert.equal(local('2026-10-26T05:00:00Z'),'2026-10-26T06:00');});
test('actual duration includes daylight saving transition',()=>assert.equal(duration(at('2026-10-24T06:00'),at('2026-10-25T06:00')),1500));
test('ambiguous and nonexistent times are rejected',()=>{assert.throws(()=>at('2026-10-25T02:30'));assert.throws(()=>at('2026-03-29T02:30'));});
test('9 h driving with a 45 min pause',()=>{const s=fixture();s.services=[service(template(540))];assert.ok(!codes(s).includes('daily-drive'));assert.ok(!codes(s).includes('driving-break'));});
test('driving over 10 h detected',()=>{const s=fixture();s.services=[service(template(601))];assert.ok(codes(s).includes('daily-drive'));});
test('15 + 30 minute split pause accepted',()=>{const s=fixture();s.services=[service([{type:'drive',minutes:120},{type:'break',minutes:15},{type:'drive',minutes:150},{type:'break',minutes:30},{type:'drive',minutes:60}])];assert.ok(!codes(s).includes('driving-break'));});
test('30 + 15 minute split pause does not reset',()=>{const s=fixture();s.services=[service([{type:'drive',minutes:120},{type:'break',minutes:30},{type:'drive',minutes:150},{type:'break',minutes:15},{type:'drive',minutes:60}])];assert.ok(codes(s).includes('driving-break'));});
test('other work and unknown gaps do not reset driving',()=>{const s=fixture();s.services=[service([{type:'drive',minutes:270},{type:'work',minutes:60},{type:'drive',minutes:1}])];assert.ok(codes(s).includes('driving-break'));s.services=[service([{type:'drive',minutes:270}]),service([{type:'drive',minutes:1}],{id:'second',start:at('2026-10-26T12:00')})];assert.ok(codes(s).includes('driving-break'));});
test('overlapping truck and driver bookings detected',()=>{const s=fixture();s.services=[service(),service(template(120),{id:'second'})];assert.ok(codes(s).includes('truck-overlap'));assert.ok(codes(s).includes('driver-overlap'));});
test('back-to-back services do not overlap',()=>{const s=fixture();const one=service(template(120));s.services=[one,service(template(120),{id:'second',driverId:'elena',start:endOf(one)})];assert.ok(!codes(s).includes('truck-overlap'));});
test('rest overlap cannot reset driving',()=>{const s=fixture();s.rests[1].start=at('2026-10-26T08:00');s.services=[service()];assert.ok(codes(s).includes('rest-overlap'));});
test('daily rest inside 24 h window, not only total duration',()=>{const s=fixture();s.services=[service(template(540))];s.rests[1].start=at('2026-10-26T22:00');s.rests[1].end=at('2026-10-27T09:00');assert.ok(codes(s).includes('daily-window'));});
test('11 h total can qualify as reduced inside the window',()=>{const s=fixture();s.services=[service(template(540))];s.rests[1].start=at('2026-10-26T20:00');s.rests[1].end=at('2026-10-27T07:00');assert.ok(!codes(s).includes('daily-window'));});
test('third daily extension in seed detected',()=>assert.ok(codes(createDemo()).includes('third-extension')));
test('rolling consecutive week totals in seed detected',()=>{const s=createDemo();assert.equal(weekMinutes(s,'luis','2026-10-26'),2640);assert.ok(codes(s).includes('fortnight-drive'));});
test('weekly minutes split at Monday midnight',()=>{const s=fixture();s.services=[service([{type:'drive',minutes:120}],{start:at('2026-11-01T23:00')})];assert.equal(weekMinutes(s,'ana','2026-10-26'),60);assert.equal(weekMinutes(s,'ana','2026-11-02'),60);});
test('daily driving does not reset at midnight',()=>{const s=fixture();s.rests[0].end=at('2026-10-26T18:00');s.rests[1].start=at('2026-10-27T08:00');s.rests[1].end=at('2026-10-27T19:00');s.services=[service(template(601),{start:at('2026-10-26T18:00')})];assert.ok(codes(s).includes('daily-drive'));});
test('weekly normal rest in cabin flagged',()=>{const s=fixture();s.rests[0].accommodation='cab';assert.ok(codes(s).includes('weekly-cabin'));});
test('international reduced weekly rests require explicit review',()=>{const r=analyse(createDemo(),'2026-10-26');assert.ok(r.issues.some(i=>i.code==='international-reduced'&&i.severity==='unknown'));assert.equal(r.obligations.length,2);});
test('bad imports and duplicate history rejected',()=>{assert.throws(()=>validateState({version:0}));const s=createDemo();s.baselines.push({...s.baselines[0]});assert.throws(()=>validateState(s));});
test('summary and detailed driving cannot be double counted',()=>{const s=createDemo();s.baselines[0].week='2026-10-26';assert.throws(()=>validateState(s));});
test('negative duration and duplicate IDs rejected',()=>{const s=createDemo();s.services[0].activities[0].minutes=-3;assert.throws(()=>validateState(s));const x=createDemo();x.services[1].id=x.services[0].id;assert.throws(()=>validateState(x));});
test('drag moves start and truck without changing driver or activities',()=>{const s=service(),changed=adjustService(s,45,'t2');assert.equal(duration(s.start,changed.start),45);assert.equal(changed.truckId,'t2');assert.equal(changed.driverId,s.driverId);assert.deepEqual(changed.activities,s.activities);assert.equal(s.truckId,'t1');});
test('resize changes only the final driving segment',()=>{const s=service(),changed=adjustService(s,30,'t1',true);assert.equal(driving(changed),driving(s)+30);assert.equal(changed.start,s.start);assert.equal(changed.activities.at(-1).minutes,30);assert.throws(()=>adjustService(s,-300,'t1',true));});
test('all truck examples are DAF and requested names are present',()=>{const s=createDemo();assert.ok(s.trucks.every(t=>t.name.startsWith('DAF')));assert.deepEqual(s.drivers.map(d=>d.name),['Mikhail','Yuri','Sandu','Gavrile','Conductor 5']);});
