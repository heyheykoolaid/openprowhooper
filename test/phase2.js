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
const LP=v3(-14,0,-16); // lamp post
const orbit=(turns, inverted, rev)=>t=>{ const w=180*D2R, R=1.6; let a=Math.min(t,0.01+turns*2*Math.PI/w)*w; if(rev && t*w>2*Math.PI){ const a1=2*Math.PI; a=a1-(Math.min(t*w,4*Math.PI+0.01)-a1); }
  const pos=v3(LP.x+R*Math.cos(a),2.2,LP.z+R*Math.sin(a)); const toP=norm(v3(LP.x-pos.x,inverted?-0.35:0.15,LP.z-pos.z)); return {pos,q:basisQ(toP, inverted?v3(0,-1,0):Y)}; };
run('orbit x2 (upright, pole centred)', orbit(2.05,false), 5.5, ['Orbit x2']);
run('trippy spin x2 (inverted)', orbit(2.05,true), 5.5, ['Trippy Spin x2']);
run('trippy switch (1 each way)', orbit(2.1,true,true), 6, ['Trippy Spin x2','Trippy Switch']);
// jump rope: fly sideways (facing along the swing bar) over it and back under it
run('jump rope (sideways over + under)', t=>{ const f=v3(1,0,0); const z=-3.5-Math.min(t,1.2)*4; const back=t>1.6?(t-1.6)*4:0;
  const pos= t<1.6? v3(0,t<1.2?2.9:2.9-(t-1.2)*3,-3.5-Math.min(t,1.2)*4) : v3(0,1.4,-8.3+back); const tilt= t<1.6?-0.3:0.3; return {pos,q:basisQ(f,norm(v3(0,1,tilt)))}; }, 3.5, ['Jump Rope']);
// burrito roll (demo: one gentle jump rope, then a big roll before crossing over, rewind down the same side, under)
run('burrito roll (jump rope, roll 270, rewind, under)', t=>{ const f=v3(1,0,0), FW=f; const lean=a=>basisQ(f,norm(v3(0,1,a)));
  if(t<1.6) return {pos:v3(0,t<1.2?2.9:2.9-(t-1.2)*3,-3.5-Math.min(t,1.2)*4), q:lean(-0.3)};          // over the bar (-z), down the far side
  if(t<2.6) return {pos:v3(0,1.4,-8.3+(t-1.6)*4), q:lean(0.3)};                                         // back under (+z) to the near side
  if(t<3.1){ const u=(t-2.6)/0.5; return {pos:v3(0,1.4+1.2*u,-4.3-0.7*u), q:qmul(lean(0.3),qaxis(v3(0,0,-1),-1.5*Math.PI*u))}; }   // climb, roll 270 the other way
  const qe=qmul(lean(0.3),qaxis(v3(0,0,-1),-1.5*Math.PI)), u=Math.min(1,(t-3.1)/0.35);
  return {pos:t<3.45?v3(0,2.6-1.3*u,-5.0-0.5*u):v3(0,1.3,-5.5-(t-3.45)*4), q:qe}; }, 4.3, ['Burrito Roll']);
// double dutch: jump rope with a 360 roll at the peak, right over the bar
run('double dutch (360 roll over the bar)', t=>{ const f=v3(1,0,0); const lean=a=>basisQ(f,norm(v3(0,1,a)));
  const pos= t<1.6? v3(0,t<1.2?2.9:2.9-(t-1.2)*3,-3.5-Math.min(t,1.2)*4) : v3(0,1.4,-8.3+(t-1.6)*4);
  const r = t<0.4?0: t<0.9? (t-0.4)/0.5*2*Math.PI : 2*Math.PI;
  return {pos, q:qmul(lean(t<1.6?-0.3:0.3), qaxis(v3(0,0,-1), r))}; }, 3.5, ['Double Dutch']);
// 360 stall rewind beside the pilot (demo: climbs up past the pilot, stalls with a 360 roll, rewinds back down)
run('360 stall rewind (beside the pilot)', t=>{ const x=2.6, z=15.4; const f=v3(0,0,-1);
  if(t<1.0) return {pos:v3(x,0.6,z+3-3*t), q:basisQ(f,Y)};                                     // fly in toward the pilot
  if(t<1.7){ const u=(t-1.0)/0.7; return {pos:v3(x,0.6+1.6*Math.sin(u*Math.PI/2),z-0.2*u), q:basisQ(f,norm(v3(0,1,0.6)))}; }   // climb, nose up
  if(t<2.3){ const u=(t-1.7)/0.6; return {pos:v3(x,2.2,z-0.2), q:qmul(basisQ(f,norm(v3(0,1,0.6))),qaxis(v3(0,0,-1),2*Math.PI*u))}; }   // stall: 360 roll
  const u=Math.min(1,(t-2.3)/0.9); return {pos:v3(x,2.2-1.5*u,z-0.2+2.2*u), q:basisQ(f,norm(v3(0,1,0.5)))}; }, 4.2, ['360 Stall Rewind']);   // rewind back down
// mavani: maverick under→over (facing forward, flying backward over the top), pitch-down 180 to invert, yaw 180 inverted, matty back under
run('mavani', t=>{ const c={y:2.2,z:-6}, R=1.1;
  if(t<0.6) return {pos:v3(0,1.1,-3-t*5),q:basisQ(FWD,Y)};                                   // under the bar at z=-6 → t=0.6
  if(t<1.4){ const f=(t-0.6)/0.8, th=f*Math.PI; return {pos:v3(0,c.y-R*Math.cos(th),c.z-R*Math.sin(th)),q:basisQ(FWD,Y)}; } // maverick up & over, still facing forward
  let q=basisQ(FWD,Y); const pos0=v3(0,c.y+R,-6+0.0);
  if(t<1.7){ const f=(t-1.4)/0.3; q=qmul(q,qaxis(X,-Math.PI*f)); return {pos:v3(0,3.3,-6+ (t-1.4)*2),q}; }   // pitch down 180 → inverted
  q=qmul(q,qaxis(X,-Math.PI));
  if(t<2.1){ const f=(t-1.7)/0.4; q=qmul(q,qaxis(Y,Math.PI*f)); return {pos:v3(0,3.3,-5.4+(t-1.7)*1),q}; }      // yaw 180 inverted
  q=qmul(q,qaxis(Y,Math.PI));
  if(t<2.6){ const f=(t-2.1)/0.5; q=qmul(q,qaxis(X,-Math.PI*f)); return {pos:v3(0,3.3-f*2.2,-5.0-f*0.4),q}; }     // matty half: pitch forward 180 → upright
  q=qmul(q,qaxis(X,-Math.PI)); return {pos:v3(0,1.1,-5.4-(t-2.6)*3),q}; }, 4, ['Mavani']);
// roll tap: roll 360 next to the graffiti wall, touching it with the bottom at 90° of roll
const wallId=id('Graffiti Wall');
run('roll tap (graffiti wall)', t=>{ const pos=v3(-18.6,1.6,0-t*3); const a=Math.max(0,Math.min(1,(t-0.6)/0.45))*2*Math.PI; const q=qmul(basisQ(FWD,Y),qaxis(v3(0,0,-1),-a));
  const contact = (Math.abs(a-3*Math.PI/2)<0.06)? {n:v3(1,0,0),owner:wallId,impact:0.8}:null; return {pos,q,contact}; }, 2.5, ['Roll Tap']);
run('wall tap (pitch back, bottom on wall)', t=>{ const pos=v3(-18.6+Math.max(0,0.5-t)*2,1.6,0); const q=qmul(basisQ(v3(-1,0,0),Y),qaxis(X, Math.min(1,t/0.4)*Math.PI/2*0.95));
  return {pos,q,contact: (t>0.5&&t<0.502)?{n:v3(1,0,0),owner:wallId,impact:0.7}:null}; }, 2, ['Wall Tap']);
// ceiling tap: under the slide tower roof (bottom at 2.6), pitch back 180 and touch it with the bottom
const roofId=id('Slide Tower');
run('ceiling tap (slide roof)', t=>{ const pos=v3(-8,2.35+Math.min(t,0.5)*0.3,2); const a=Math.max(0,Math.min(1,(t-0.3)/0.4))*Math.PI; const q=qmul(basisQ(FWD,Y),qaxis(X,a));
  return {pos,q,contact:(t>0.72&&t<0.722)?{n:v3(0,-1,0),owner:roofId,impact:0.6}:null}; }, 2, ['Ceiling Tap']);
// flip stall rewind beside the building: climb, flip at the apex, fall back the way you came
run('flip stall rewind (building)', t=>{ const y= t<1? 1+t*5 - 1.5*t*t : null; const tt=Math.max(0,t-0.5);
  const ypos = 1 + 5*t - 2.5*t*t; const pos=v3(3,Math.max(0.6,ypos),-20.5+(t>1.4?(t-1.4)*2:0)); const a=Math.max(0,Math.min(1,(t-0.75)/0.45))*2*Math.PI; return {pos,q:qmul(basisQ(FWD,Y),qaxis(X,a))}; }, 3, ['Flip Stall Rewind']);
// eject roll: climb in front of the building, pitch down 180 at the top, roll 360 on the way down
run('eject roll', t=>{ const ypos = 1 + 5*t - 2.5*t*t; const pos=v3(-3,Math.max(0.6,ypos),-20.8); let q=basisQ(FWD,Y);
  if(t>1.0) q=qmul(q,qaxis(X,-Math.PI*Math.min(1,(t-1.0)/0.35))); if(t>1.4) q=qmul(q,qaxis(v3(0,0,-1),2*Math.PI*Math.min(1,(t-1.4)/0.45))); return {pos,q}; }, 3, ['Eject Roll']);
// reverse knife edge: backward through the wall slot, rolled 90, after a 180 pitch
run('reverse knife edge (wall slot)', t=>{ const x=-17.5-t*1.5; let q=basisQ(v3(-1,0,0),Y); q=qmul(q,qaxis(X,Math.PI*Math.min(1,t/0.4)));  q=qmul(q,qaxis(v3(0,0,-1),Math.PI/2*Math.min(1,Math.max(0,(t-0.45)/0.25))));
  return {pos:v3(x,1.1,4),q}; }, 2.2, ['Reverse Knife Edge']);
run('facepunch', t=>({pos:v3(2.6,1.66,13.4+ Math.max(0,1-t)*2),q:basisQ(v3(0,0,1),Y),contact:(t>1&&t<1.002)?{n:v3(0,0,-1),owner:id('Pilot'),impact:2}:null}), 2, ['Facepunch']);
// live counting: points grow every half lap while orbiting; a crash mid-orbit keeps the completed laps, loses the rest
if(!ONLY || 'live'.includes(ONLY)){ const det=new S.TrickDetector(W); const d=Object.create(S.Drone.prototype); d.armed=true; d.crashed=false; const g=orbit(3,true); let pq=null,pp=null; const seen=[]; const got=[];
  for(let t=0;t<4.5;t+=0.001){ const s=g(t); let q=s.q; if(pq&&(q.w*pq.w+q.x*pq.x+q.y*pq.y+q.z*pq.z)<0) q={w:-q.w,x:-q.x,y:-q.y,z:-q.z}; let w=v3(); if(pq){const dq={w:(q.w-pq.w)/0.001,x:(q.x-pq.x)/0.001,y:(q.y-pq.y)/0.001,z:(q.z-pq.z)/0.001}; const r=qmul({w:q.w,x:-q.x,y:-q.y,z:-q.z},dq); w=v3(2*r.x,2*r.y,2*r.z);}
    d.vel=pp?mul(sub(s.pos,pp),1000):v3(); pp=s.pos; pq=q; d.pos=s.pos; d.q=q; d.w=w; d.contactThisStep=false; if(t>4.2) { d.crashed=true; d.armed=false; }
    det.update(d,0.001); const ls=det.liveState()[0]; if(ls && (!seen.length || seen[seen.length-1]!==ls.laps)) seen.push(ls.laps); for(const e of det.drain()) got.push(e.name + (e.laps ? ' ×' + e.laps : '')); }
  const tr = got.find(n=>n.startsWith('Trippy Spin')), ok = seen.length>=4 && !!tr && /×[12]$/.test(tr) && got.indexOf(tr) < got.indexOf('Crash') && got.includes('Crash'); total++; if(ok) pass++;
  console.log(`${ok?'PASS':'FAIL'} live trippy counter, crash at the end   -> laps seen live ${seen.join(' → ')} · banked before the crash: ${got.filter(n=>n!=='Crash').join(', ')||'nothing'}`); }
console.log(`\n${pass}/${total} phase-2 flights correct`);
// orbit the whole slide tower (4 posts) and a single swing-set leg
const ST=v3(-8,0,2);
run('orbit x2 around the slide tower', t=>{ const w=150*D2R, R=2.2, a=Math.min(t,0.01+2.05*2*Math.PI/w)*w; const pos=v3(ST.x+R*Math.cos(a),1.9,ST.z+R*Math.sin(a)); return {pos,q:basisQ(norm(v3(ST.x-pos.x,0.1,ST.z-pos.z)),Y)}; }, 6.5, ['Orbit x2']);
run('trippy spin x2 around the pilot', t=>{ const C=v3(2.6,0,14.2), w=170*D2R, R=1.4, a=Math.min(t,0.01+2.05*2*Math.PI/w)*w; const pos=v3(C.x+R*Math.cos(a),1.7,C.z+R*Math.sin(a)); return {pos,q:basisQ(norm(v3(C.x-pos.x,-0.35,C.z-pos.z)),v3(0,-1,0))}; }, 6, ['Trippy Spin x2']);
