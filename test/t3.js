require('../src/tricks.js'); require('../src/sim.js');
const S=globalThis.Sim; const world=S.buildPlayground();
function fake(){ const d=Object.create(S.Drone.prototype); d.pos=S.v3(0,2,0); d.vel=S.v3(); d.q={w:1,x:0,y:0,z:0}; d.w=S.v3(); d.armed=true; d.crashed=false; d.contactThisStep=false; return d; }
const X=S.v3(1,0,0),Y=S.v3(0,1,0),Z=S.v3(0,0,1);
function run(name, gen, T){ const det=new S.TrickDetector(world), sk=new S.ScoreKeeper(); const d=fake(); const dt=0.002; let prev=null;
  for(let t=0;t<T;t+=dt){ const s=gen(t); d.vel=prev?S.mul(S.sub(s.pos,prev),1/dt):S.v3(); prev=s.pos; d.pos=s.pos; d.q=s.q; d.w=s.w; det.update(d,dt); }
  const ev=det.drain(); console.log(name.padEnd(22),'->', ev.map(e=>{const r=sk.add(e); return `${e.name} [${e.exec} ${e.clean??''}] ${r?'+'+r.net:''} toks:${(e.toks||[]).map(t=>t.ax+(t.dir>0?'+':'-')+Math.round(t.raw)+(t.inv?'i':'')).join(' ')}`}).join(' | ') || 'nothing');
}
// open air rotation sequence helper: list of [axis, degPerSec, durationSec]
function seq(steps, pause=0.8){ return t=>{ let q={w:1,x:0,y:0,z:0}, tt=0, w=S.v3(); const p=S.v3(0,4,0);
  if(t<pause) return {pos:p,q,w};
  let t2=t-pause;
  for(const [ax,rate,dur] of steps){ const a = ax==='P'?X: ax==='R'?S.v3(0,0,-1): S.v3(0,-1,0);
    const sgn=1; const dd=Math.min(t2,dur); if(dd>0){ const ang=rate*Math.PI/180*dd; q=S.qnorm(S.qmul(q,S.qaxis(a,ang))); }
    if(t2<dur){ w=S.mul(a,rate*Math.PI/180); return {pos:p,q,w}; } t2-=dur; }
  return {pos:p,q,w:S.v3()}; }; }
run('backflip', seq([['P',800,0.45]]),5);
run('frontflip', seq([['P',-800,0.45]]),5);
run('roll', seq([['R',900,0.4]]),5);
run('double roll', seq([['R',900,0.8]]),5);
run('cubiks rube (R P R)', seq([['R',900,0.2],['P',800,0.45],['R',900,0.2]]),5);
run('yaw spin', seq([['Y',600,0.6]]),5);
run('invert rewind', seq([['R',900,0.2],['R',-900,0.2]]),5);
run('inverted yaw spin', seq([['P',800,0.225],['Y',600,0.6],['P',800,0.225]]),5);
run('sloppy flip (stall)', seq([['P',800,0.2],['P',0,0.45],['P',800,0.25]]),5);
run('juicy flick', seq([['P',-800,0.225],['R',900,0.2]]),5);
run('flip then roll', seq([['P',800,0.45],['R',900,0.4]]),5);
// powerloop around swing bar (z=-6, y=2.4): circle centre (z=-6,y=2.2) r=1.1
function loop(extraPeak){ return t=>{ const v=6, R=1.1, c={y:2.2,z:-6}; const L0=4; // straight in from z=-2 at y=1.1
  const sIn=t*v; if(sIn<L0) return {pos:S.v3(0,c.y-R, -2 - sIn + 0), q:{w:1,x:0,y:0,z:0}, w:S.v3()};
  const th=(sIn-L0)/R; // angle travelled, starting at bottom directly under centre moving -z
  if(th<2*Math.PI){ const pos=S.v3(0, c.y - R*Math.cos(th), c.z - R*Math.sin(th));
    let q=S.qaxis(X,th); let w=S.mul(X,v/R);
    if(extraPeak && th>Math.PI*0.85 && th<Math.PI*1.15){ const f=(th-Math.PI*0.85)/(0.3*Math.PI); q=S.qmul(q,S.qaxis(S.v3(0,0,-1),f*2*Math.PI)); w=S.add(w,S.mul(S.v3(0,0,-1),2*Math.PI/(0.3*Math.PI*R/v))); }
    return {pos,q,w}; }
  const s2=sIn-L0-2*Math.PI*R; return {pos:S.v3(0,c.y-R,c.z - s2), q:{w:1,x:0,y:0,z:0}, w:S.v3()}; }; }
run('powerloop (swing)', loop(false), 4);
run('power roll (swing)', loop(true), 4);
// split-S over the swing bar: fly over at y=3 moving -z, roll 180 at bar, half loop down & back under moving +z
run('split-S (swing)', t=>{ const v=5;
  if(t<1.2) return {pos:S.v3(1,3.2,-1 - t*v), q:{w:1,x:0,y:0,z:0}, w:S.v3()};      // passes over bar at t=1.0
  if(t<1.4){ const f=(t-1.2)/0.2; return {pos:S.v3(1,3.2,-7-(t-1.2)*v), q:S.qaxis(S.v3(0,0,-1),f*Math.PI), w:S.mul(S.v3(0,0,-1),Math.PI/0.2)}; }
  const th=(t-1.4)*v/1.0; const base=S.qaxis(S.v3(0,0,-1),Math.PI);
  if(th<Math.PI){ return {pos:S.v3(1, 2.2+1.0*Math.cos(th), -8 - 1.0*Math.sin(th)), q:S.qmul(base,S.qaxis(X,th)), w:S.mul(X,v/1.0)}; }
  const s=(t-1.4)-Math.PI*1.0/v; return {pos:S.v3(1,1.2,-8+s*v), q:S.qmul(base,S.qaxis(X,Math.PI)), w:S.v3()}; }, 4);
run('segmented flip', seq([['P',800,0.225],['P',0,0.55],['P',800,0.225]]),5);
run('short stall flip', seq([['P',800,0.2],['P',0,0.25],['P',800,0.25]]),5);
// Tricktionary demo timings (Segmented Flips/Rolls GIF, real time from the OSD clock)
run('demo segmented roll', seq([['R',900,0.2],['R',0,0.27],['R',900,0.2]]),5);
run('demo segmented flip', seq([['P',850,0.21],['P',0,0.23],['P',850,0.21]]),5);
run('hesitant flip 0.1s', seq([['P',800,0.2],['P',0,0.1],['P',800,0.25]]),5);
// Tricktionary demo rates: flip ~0.4 s, roll ~0.36 s, double flip ~0.85 s, yaw spin ~1 s
run('demo flip', seq([['P',-900,0.4]]),5);
run('demo roll', seq([['R',1000,0.36]]),5);
run('demo double flip', seq([['P',850,0.85]]),5);
run('demo double roll', seq([['R',900,0.8]]),5);
run('demo yaw spin', seq([['Y',360,1.0]]),5);
// Tricktionary demo timings, batch 2 (real time from the goggle OSD clock)
run('demo invert rewind R', seq([['R',600,0.3],['R',-600,0.3]]),5);
run('demo invert rewind P', seq([['P',640,0.28],['P',-560,0.32]]),5);
run('demo vanny roll', seq([['Y',-320,0.56],['R',720,0.5],['Y',-280,0.64]]),5);
run('demo rubiks cube (P R P)', seq([['P',600,0.3],['R',680,0.53],['P',450,0.4]]),5);
run('demo cubiks rube (R P R)', seq([['R',700,0.26],['P',515,0.7],['R',430,0.42]]),5);
run('demo juicy flick', seq([['P',-670,0.27],['R',530,0.34]]),5);
run('demo inverted yaw spin', seq([['R',-690,0.26],['Y',640,0.56],['R',-600,0.3]]),5);
