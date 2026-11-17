require('../src/tricks.js'); require('../src/sim.js');
const S=globalThis.Sim; const world=S.buildPlayground();
function fake(){ const d=Object.create(S.Drone.prototype); d.pos=S.v3(0,2,0); d.vel=S.v3(); d.q={w:1,x:0,y:0,z:0}; d.w=S.v3(); d.armed=true; d.crashed=false; d.contactThisStep=false; return d; }
const X=S.v3(1,0,0);
function run(name, gen, T){ const det=new S.TrickDetector(world), sk=new S.ScoreKeeper(); const d=fake(); const dt=0.002; let prev=null;
  for(let t=0;t<T;t+=dt){ const s=gen(t); d.vel=prev?S.mul(S.sub(s.pos,prev),1/dt):S.v3(); prev=s.pos; d.pos=s.pos; d.q=s.q; d.w=s.w; det.update(d,dt); }
  const ev=det.drain(); console.log(name.padEnd(34),'->', ev.map(e=>`${e.name} [${e.exec} ${e.clean??''}]${e.near?' '+e.near:''}`).join(' | ') || 'nothing', det.debug ? '\n      dbg: '+JSON.stringify(det.debug.slice(-1).map(x=>[x.toks,x.cross,x.result,x.near])) : '');
}
const lerp=(a,b,f)=>a+(b-a)*f;
// realistic powerloop: long straight approach under the bar (under crossing ~1.6s before rotation peaks), slow float at top
function loopR(R, approach, exit, floatTop){ return t=>{ const v=5, c={y:2.2,z:-6};
  const sIn=t*v; if(sIn<approach) return {pos:S.v3(0,c.y-R, -6+approach - sIn), q:{w:1,x:0,y:0,z:0}, w:S.v3()}; // passes under at z=-6 when sIn=approach... start is behind
  let th=(sIn-approach)/R; // rotation
  const slow = floatTop ? (th>Math.PI*0.8 && th<Math.PI*1.2) : false;
  if(th<2*Math.PI){ const pos=S.v3(0, c.y - R*Math.cos(th), c.z - R*Math.sin(th)); return {pos,q:S.qaxis(X,th),w:S.mul(X,v/R*(slow?0.55:1))}; }
  const s2=sIn-approach-2*Math.PI*R; return {pos:S.v3(0,c.y-R,c.z - s2), q:{w:1,x:0,y:0,z:0}, w:S.v3()}; }; }
// approach passes under the bar right at rotation start (sIn=approach at z=-6). Exit: passes under bar again at end of loop (z=-6) immediately -> exit straight continues.
run('powerloop, tight', loopR(1.0,6,0,false),6);
// oval powerloop: centre just in front of the bar, wide horizontally, exits forward under the bar
run('powerloop, oval + forward exit', t=>{ const v=5, Rx=1.6, Ry=1.1, c={y:2.25,z:-5.6};
  const s=t*v; if (s<4) return {pos:S.v3(0,c.y-Ry,c.z+4-s),q:{w:1,x:0,y:0,z:0},w:S.v3()};
  const th=(s-4)/1.35; if (th<2*Math.PI) return {pos:S.v3(0,c.y-Ry*Math.cos(th),c.z-Rx*Math.sin(th)),q:S.qaxis(X,th),w:S.mul(X,v/1.35)};
  const s2=s-4-2*Math.PI*1.35; return {pos:S.v3(0,c.y-Ry,c.z-s2),q:{w:1,x:0,y:0,z:0},w:S.v3()}; }, 6);
// realistic matty: fly over bar forward (-z) at 3.2m, 0.8 s later pitch forward ~300 deg while dropping behind, then fly backwards (+z) under bar 1.2 s after rotation ends
run('matty flip (forward 300, late under)', t=>{ const v=5;
  if (t<1.6) return {pos:S.v3(0,3.2,2-t*v),q:{w:1,x:0,y:0,z:0},w:S.v3()};          // crosses bar (z=-6) at t=1.6
  if (t<2.2){ const f=(t-1.6)/0.6, th=-f*300*S.D2R; return {pos:S.v3(0,lerp(3.2,1.3,f),lerp(-6,-8.2,f)),q:S.qaxis(X,th),w:S.mul(X,-300*S.D2R/0.6)}; }
  const q=S.qaxis(X,-300*S.D2R); const t2=t-2.2; // now flying backwards toward +z, slowly leveling
  const qq = t2<0.3 ? S.qaxis(X,-(300+60*t2/0.3)*S.D2R) : S.qaxis(X,-360*S.D2R);
  return {pos:S.v3(0,1.2,-8.2+t2*1.9),q:qq,w:t2<0.3?S.mul(X,-60*S.D2R/0.3):S.v3()}; }, 5);
// matty that ends upright but flying FORWARD (yawed around) -> should not be a Matty
run('fake matty (ends flying forward)', t=>{ const v=5;
  if (t<1.6) return {pos:S.v3(0,3.2,2-t*v),q:{w:1,x:0,y:0,z:0},w:S.v3()};
  if (t<2.2){ const f=(t-1.6)/0.6, th=-f*360*S.D2R; return {pos:S.v3(0,lerp(3.2,1.3,f),lerp(-6,-8.2,f)),q:S.qaxis(X,th),w:S.mul(X,-360*S.D2R/0.6)}; }
  const t2=t-2.2; return {pos:S.v3(0,1.2,-8.2+t2*1.9),q:S.qaxis(S.v3(0,1,0),Math.PI),w:S.v3()}; }, 5);
// matty that ends inverted
run('matty ending inverted', t=>{ const v=5;
  if (t<1.6) return {pos:S.v3(0,3.2,2-t*v),q:{w:1,x:0,y:0,z:0},w:S.v3()};
  if (t<2.0){ const f=(t-1.6)/0.4, th=-f*180*S.D2R; return {pos:S.v3(0,lerp(3.2,1.3,f),lerp(-6,-8.2,f)),q:S.qaxis(X,th),w:S.mul(X,-180*S.D2R/0.4)}; }
  const t2=t-2.0; return {pos:S.v3(0,1.2,-8.2+t2*1.9),q:S.qaxis(X,-Math.PI),w:S.v3()}; }, 5);
run('slow floaty powerloop (150-200°/s)', t=>{ const v=3.6, R=1.15, c={y:2.2,z:-6}; const sIn=t*v; const L0=4;
  if(sIn<L0) return {pos:S.v3(0,c.y-R,c.z+L0-sIn),q:{w:1,x:0,y:0,z:0},w:S.v3()};
  const th=(sIn-L0)/R; if(th<2*Math.PI) return {pos:S.v3(0,c.y-R*Math.cos(th),c.z-R*Math.sin(th)),q:S.qaxis(X,th),w:S.mul(X,v/R)};
  return {pos:S.v3(0,c.y-R,c.z-(sIn-L0-2*Math.PI*R)),q:{w:1,x:0,y:0,z:0},w:S.v3()}; }, 7);
