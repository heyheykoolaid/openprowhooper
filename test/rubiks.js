// Rubik's Cube as pilots fly it (2026-11-22: corrections by 3 pilots): a long roll, a short flip out, and never read as a
// 360 Stall Rewind / Eject Roll when a half flip on each side makes it the whole trick. Synthetic flights.
require('../src/tricks.js'); require('../src/sim.js'); const S=globalThis.Sim; const W=S.buildPlayground();
const {v3,add,sub,mul,qmul,qaxis,qnorm,D2R}=S; const X=v3(1,0,0),Y=v3(0,1,0),FWD=v3(0,0,-1);
const norm=a=>mul(a,1/(S.len(a)||1)); const cross=(a,b)=>v3(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
function basisQ(f,u){ f=norm(f); const r=norm(cross(f,u)); u=cross(r,f); const m=[[r.x,u.x,-f.x],[r.y,u.y,-f.y],[r.z,u.z,-f.z]];
  const tr=m[0][0]+m[1][1]+m[2][2]; let q; if(tr>0){const s=Math.sqrt(tr+1)*2; q={w:s/4,x:(m[2][1]-m[1][2])/s,y:(m[0][2]-m[2][0])/s,z:(m[1][0]-m[0][1])/s};}
  else if(m[0][0]>m[1][1]&&m[0][0]>m[2][2]){const s=Math.sqrt(1+m[0][0]-m[1][1]-m[2][2])*2; q={w:(m[2][1]-m[1][2])/s,x:s/4,y:(m[0][1]+m[1][0])/s,z:(m[0][2]+m[2][0])/s};}
  else if(m[1][1]>m[2][2]){const s=Math.sqrt(1+m[1][1]-m[0][0]-m[2][2])*2; q={w:(m[0][2]-m[2][0])/s,x:(m[0][1]+m[1][0])/s,y:s/4,z:(m[1][2]+m[2][1])/s};}
  else {const s=Math.sqrt(1+m[2][2]-m[0][0]-m[1][1])*2; q={w:(m[1][0]-m[0][1])/s,x:(m[0][2]+m[2][0])/s,y:(m[1][2]+m[2][1])/s,z:s/4};} return qnorm(q); }
let pass=0,total=0; const ONLY=process.argv[2];
if(process.env.DBG){ const P=S.TrickDetector.prototype; const eo=P.endOrbit; P.endOrbit=function(Pl,ob){ console.log('   orbit seg', Pl.name,'acc',Math.round(ob.acc),'inv',(ob.inv/ob.n).toFixed(2),'top',(ob.top/ob.n).toFixed(2),'view',(ob.view/ob.n).toFixed(2)); return eo.call(this,Pl,ob); };
  const tc=P.trackCrossings; P.trackCrossings=function(d,t){ const n=this.crossLog.length; tc.call(this,d,t); if(this.crossLog.length>n){const c=this.crossLog[this.crossLog.length-1]; console.log('   cross',c.name,c.kind,'lat',(c.latDot||0).toFixed(2),'t',t.toFixed(2));} }; }
function run(name, gen, T, expect){ if(ONLY && !name.includes(ONLY)) return; const det=new S.TrickDetector(W); const d=Object.create(S.Drone.prototype); d.armed=true; d.crashed=false; const dt=0.001; let pq=null,pp=null; const got=[];
  for(let t=0;t<T;t+=dt){ const s=gen(t); let q=s.q; if(pq && (q.w*pq.w+q.x*pq.x+q.y*pq.y+q.z*pq.z)<0) q={w:-q.w,x:-q.x,y:-q.y,z:-q.z};
    let w=v3(); if(pq){ const dq={w:(q.w-pq.w)/dt,x:(q.x-pq.x)/dt,y:(q.y-pq.y)/dt,z:(q.z-pq.z)/dt}; const r=qmul({w:q.w,x:-q.x,y:-q.y,z:-q.z},dq); w=v3(2*r.x,2*r.y,2*r.z); }
    d.vel=pp?mul(sub(s.pos,pp),1/dt):v3(); pp=s.pos; pq=q; d.pos=s.pos; d.q=q; d.w=w;
    d.contactThisStep=!!s.contact; if(s.contact){ d.contactNormal=s.contact.n; d.contactOwner=s.contact.owner; d.lastImpact=s.contact.impact||1; d.contactGround=false; }
    det.update(d,dt); for(const e of det.drain()) if(e.name!=='near') got.push(e); }
  const names=got.map(e=>e.name); const ok=expect.every(x=>names.includes(x)) && names.filter(n=>!expect.includes(n)).length===0; total++; if(ok) pass++;
  console.log(`${ok?'PASS':'FAIL'} ${name.padEnd(30)} -> ${got.map(e=>e.name+(e.exec!=='CLEAN'?'['+e.exec+']':'')).join(' | ')||'nothing'}${ok?'':'   expected: '+expect.join(' | ')}`); }
const id=n=>W.objs.find(o=>o.name===n).id;
const PITCH=v3(1,0,0), ROLL=v3(0,0,-1);
// open air, away from everything: [axis, degrees, seconds] in turn
function air(parts){ return t=>{ const pos=v3(0,4,8); let q={w:1,x:0,y:0,z:0}, t2=t-0.5;
  for(const [ax,deg,dur] of parts){ const a=ax==='P'?PITCH:ROLL, dd=Math.min(Math.max(t2,0),dur); q=qmul(q,qaxis(a,deg*D2R*dd/dur)); t2-=dur; } return {pos,q}; }; }
// climb beside the pilot, stall at the top, then the parts
function stall(parts){ return t=>{ const x=2.6, z=15.4, f=v3(0,0,-1);
  if(t<1.0) return {pos:v3(x,0.6,z+3-3*t), q:basisQ(f,Y)};
  if(t<1.7){ const u=(t-1.0)/0.7; return {pos:v3(x,0.6+1.6*Math.sin(u*Math.PI/2),z-0.2*u), q:basisQ(f,norm(v3(0,1,0.6)))}; }
  let q=basisQ(f,norm(v3(0,1,0.6))), t2=t-1.7;
  for(const [ax,deg,dur] of parts){ const a=ax==='P'?PITCH:ROLL, dd=Math.min(Math.max(t2,0),dur); q=qmul(q,qaxis(a,deg*D2R*dd/dur)); t2-=dur; }
  const fall=Math.max(0,t2); return {pos:v3(x,Math.max(0.6,2.2-0.8*fall),z-0.2+1.5*Math.min(fall,1)), q}; }; }
const RC=["Rubik's Cube"];
run('demo timing', air([['P',180,0.3],['R',360,0.53],['P',180,0.4]]), 4, RC);
run('long roll, short flip out', air([['P',186,0.3],['R',-421,0.53],['P',230,0.55]]), 4, RC);
run('flip out reads 125', air([['P',156,0.25],['R',-387,0.5],['P',125,0.3]]), 4, RC);
run('backward, roll 436', air([['P',-174,0.32],['R',-436,0.65],['P',-167,0.29]]), 4, RC);
run('beside the pilot', stall([['P',180,0.3],['R',360,0.53],['P',180,0.4]]), 4.5, RC);
run('beside the pilot, long roll, short flip out', stall([['P',186,0.3],['R',-421,0.55],['P',130,0.35]]), 4.5, RC);
run('half flip then a roll is not one', air([['P',180,0.3],['R',360,0.53]]), 4, ['Roll']);
console.log(`rubiks: ${pass}/${total}`);
