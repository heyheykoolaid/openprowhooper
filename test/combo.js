require('../src/tricks.js'); require('../src/sim.js');
const S=globalThis.Sim; const world=S.buildPlayground(); const X=S.v3(1,0,0);
const which = process.argv[2] === 'legacy' ? S.LegacyTrickDetector : S.TrickDetector;
function fake(){ const d=Object.create(S.Drone.prototype); d.pos=S.v3(0,4,0); d.vel=S.v3(); d.q={w:1,x:0,y:0,z:0}; d.w=S.v3(); d.armed=true; d.crashed=false; d.contactThisStep=false; return d; }
let pass=0,total=0; const lat=[];
function run(name, gen, T, expect){ const det=new which(world); const d=fake(); const dt=0.001; let prev=null; const got=[];
  for(let t=0;t<T;t+=dt){ const s=gen(t); d.vel=s.vel||(prev?S.mul(S.sub(s.pos,prev),1/dt):S.v3()); prev=s.pos; d.pos=s.pos; d.q=s.q; d.w=s.w; det.update(d,dt); for(const e of det.drain()) if(e.name!=='near') got.push({...e, at:t}); }
  const names=got.map(e=>e.name); const ok=JSON.stringify(names)===JSON.stringify(expect); total++; if(ok) pass++;
  got.forEach(e=>{ if(e.latency!==undefined) lat.push(e.latency); });
  console.log(`${ok?'PASS':'FAIL'} ${name.padEnd(36)} -> ${got.map(e=>`${e.name}${e.exec!=='CLEAN'?'['+e.exec+']':''}${e.latency!==undefined?' ('+Math.round(e.latency*1000)+'ms)':''}`).join(' | ')||'nothing'}${ok?'':'   expected: '+expect.join(' | ')}`);
}
// attitude-only sequences at a fixed spot away from obstacles. step: [axis, deg/s, seconds]
function seq(steps, pos=S.v3(0,4,8)){ return t=>{ let q={w:1,x:0,y:0,z:0}, w=S.v3(), t2=t-0.5; if(t2<0) return {pos,q,w};
  for(const [ax,rate,dur] of steps){ const a= ax==='P'?X: ax==='R'?S.v3(0,0,-1): S.v3(0,-1,0); const dd=Math.min(t2,dur); if(dd>0) q=S.qnorm(S.qmul(q,S.qaxis(a,rate*S.D2R*dd)));
    if(t2<dur){ w=S.mul(a,rate*S.D2R); return {pos,q,w}; } t2-=dur; } return {pos,q,w:S.v3()}; }; }
const F=(dir=1)=>['P',800*dir,0.45], Rl=(dir=1)=>['R',900*dir,0.4], Yw=['Y',700,360/700], gap=s=>['P',0,s];
run('flip, roll (0.3s gap)', seq([F(),gap(0.3),Rl()]),3,['Flip','Roll']);
run('flip, roll (0.05s gap)', seq([F(),gap(0.05),Rl()]),3,['Flip','Roll']);
run('roll, flip, roll, yaw (0.15s gaps)', seq([Rl(),gap(0.15),F(-1),gap(0.15),Rl(-1),gap(0.15),Yw]),4,['Roll','Flip','Roll','Yaw Spin']);
run("cubik's then flip (0.1s)", seq([['R',900,0.2],F(),['R',900,0.2],gap(0.1),F()]),4,["Cubik's Rube",'Flip']);
run("flip then cubik's (0.1s)", seq([F(),gap(0.1),['R',900,0.2],F(),['R',900,0.2]]),4,['Flip',"Cubik's Rube"]);
run('juicy flick, invert rewind', seq([['P',-800,0.225],['R',900,0.2],gap(0.15),['R',900,0.2],['R',-900,0.2]]),4,['Juicy Flick','Invert Rewind']);
run('juicy tornado (flick, roll runs on 2 more turns)', seq([['P',-800,0.225],['R',900,1.0]]),4,['Juicy Tornado']);
run('juicy tornado (double roll after a breath)', seq([['P',-800,0.225],['R',900,0.2],gap(0.15),['R',900,0.8]]),4,['Juicy Tornado']);
run('juicy flick then a roll the other way is not a tornado', seq([['P',-800,0.225],['R',900,0.2],gap(0.5),['R',-900,0.4]]),4,['Juicy Flick','Roll']);
run('double flip vs flip+flip(0.3s)', seq([F(),gap(0.3),F()]),3,['Flip','Flip']);
run('double flip (no pause)', seq([['P',800,0.9]]),3,['Double Flip']);
run('inverted yaw spin, roll', seq([['P',800,0.225],Yw,['P',800,0.225],gap(0.1),Rl()]),4,['Inverted Yaw Spin','Roll']);
// obstacle combos at the swing bar (z=-6, top 2.4). powerloop circle radius R centred at bar.
function loopGen(t0, v=5, R=1.1, c={y:2.2,z:-6}){ return t=>{ const th=(t-t0)*v/R; return {pos:S.v3(0,c.y-R*Math.cos(th),c.z-R*Math.sin(th)), q:S.qaxis(X,th), w:S.mul(X,v/R), vel:S.v3(0, v*Math.sin(th)/1, -v*Math.cos(th))}; }; }
run('powerloop x2 chained', t=>{ const v=5,R=1.1; const L=2*Math.PI*R/v;
  if(t<0.8) return {pos:S.v3(0,1.1,-6+4-t*5),q:{w:1,x:0,y:0,z:0},w:S.v3(),vel:S.v3(0,0,-5)};
  const tt=t-0.8; if(tt<2*L){ const th=tt*v/R; return {pos:S.v3(0,2.2-R*Math.cos(th),-6-R*Math.sin(th)+0),q:S.qaxis(X,th),w:S.mul(X,v/R),vel:S.v3(0,v*Math.sin(th),-v*Math.cos(th))}; }
  const s2=(tt-2*L)*v; return {pos:S.v3(0,1.1,-6-s2),q:{w:1,x:0,y:0,z:0},w:S.v3(),vel:S.v3(0,0,-5)}; }, 5, ['Powerloop','Powerloop']);
run('powerloop then roll right after', t=>{ const v=5,R=1.1; const L=2*Math.PI*R/v;
  if(t<0.8) return {pos:S.v3(0,1.1,-2-t*5),q:{w:1,x:0,y:0,z:0},w:S.v3(),vel:S.v3(0,0,-5)};
  const tt=t-0.8; if(tt<L){ const th=tt*v/R; return {pos:S.v3(0,2.2-R*Math.cos(th),-6-R*Math.sin(th)),q:S.qaxis(X,th),w:S.mul(X,v/R),vel:S.v3(0,v*Math.sin(th),-v*Math.cos(th))}; }
  const t3=tt-L, pos=S.v3(0,1.1,-6-t3*v);
  if(t3>0.25 && t3<0.65){ return {pos,q:S.qaxis(S.v3(0,0,-1),(t3-0.25)*900*S.D2R),w:S.mul(S.v3(0,0,-1),900*S.D2R),vel:S.v3(0,0,-5)}; }
  return {pos,q:{w:1,x:0,y:0,z:0},w:S.v3(),vel:S.v3(0,0,-5)}; }, 4, ['Powerloop','Roll']);
run('matty then roll (roll during exit)', t=>{ const v=5, lerp=(a,b,f)=>a+(b-a)*f;
  if (t<1.6) return {pos:S.v3(0,3.2,2-t*v),q:{w:1,x:0,y:0,z:0},w:S.v3()};
  if (t<2.1){ const f=(t-1.6)/0.5, th=-f*360*S.D2R; return {pos:S.v3(0,lerp(3.2,1.3,f),lerp(-6,-7.5,f)),q:S.qaxis(X,th),w:S.mul(X,-360*S.D2R/0.5)}; }
  const t2=t-2.1, pos=S.v3(0,1.2,-7.5+t2*3), vel=S.v3(0,0,3);
  if(t2>0.6&&t2<1.0) return {pos,q:S.qaxis(S.v3(0,0,-1),(t2-0.6)*900*S.D2R),w:S.mul(S.v3(0,0,-1),900*S.D2R),vel};
  return {pos,q:{w:1,x:0,y:0,z:0},w:S.v3(),vel}; }, 4, ['Matty Flip','Roll']);
lat.sort((a,b)=>a-b);
console.log(`\n${pass}/${total} combos correct · lock-in latency median ${Math.round(lat[lat.length>>1]*1000)} ms, max ${Math.round(lat[lat.length-1]*1000)} ms`);
