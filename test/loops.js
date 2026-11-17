// Powerloop vs Maverick Loop with realistic pacing (float over the top, rotation finishing after the last pass)
require('../src/tricks.js'); require('../src/sim.js'); const S=globalThis.Sim; const W=S.buildPlayground();
const {v3,sub,mul,qmul,qaxis}=S; const X=v3(1,0,0);
let pass=0,total=0;
function run(name, gen, T, expect){ const det=new S.TrickDetector(W); const d=Object.create(S.Drone.prototype); d.armed=true; d.crashed=false; d.contactThisStep=false; const dt=0.001; let pq=null,pp=null; const got=[];
  for(let t=0;t<T;t+=dt){ const s=gen(t); let q=s.q; if(pq&&(q.w*pq.w+q.x*pq.x+q.y*pq.y+q.z*pq.z)<0) q={w:-q.w,x:-q.x,y:-q.y,z:-q.z};
    let w=v3(); if(pq){const dq={w:(q.w-pq.w)/dt,x:(q.x-pq.x)/dt,y:(q.y-pq.y)/dt,z:(q.z-pq.z)/dt}; const r=qmul({w:q.w,x:-q.x,y:-q.y,z:-q.z},dq); w=v3(2*r.x,2*r.y,2*r.z);}
    d.vel=pp?mul(sub(s.pos,pp),1/dt):v3(); pp=s.pos; pq=q; d.pos=s.pos; d.q=q; d.w=w; det.update(d,dt); for(const e of det.drain()) if(e.name!=='near') got.push(e); }
  const names=got.map(e=>e.name); const ok=JSON.stringify(names)===JSON.stringify(expect); total++; if(ok) pass++;
  console.log(`${ok?'PASS':'FAIL'} ${name.padEnd(44)} -> ${names.join(' | ')||'nothing'}${ok?'':'   expected '+expect.join(' | ')}`);
  if(!ok && process.env.DBG) console.log('      ', JSON.stringify(det.debug.slice(-2).map(x=>[x.result,x.toks,x.cross])));
}
// loop around the swing bar (z=-6, top 2.4). angle th(t) is the pitch-back angle; position follows a circle of radius R around (y=2.2,z=-6)
// profile: pitch rate in deg/s as a function of the angle travelled (slow 'float' near the top)
function loop({R=1.15, v=5, floatRate=60, floatSpan=[150,215], extra=0, mav=false}){
  let th=0, t0=0.8; const L=4; let s=0;
  return t=>{ const dt=0.001;
    if(t<t0) return {pos:v3(0,2.2-R,-6+L*(1-t/t0)), q:{w:1,x:0,y:0,z:0}};   // approach under the bar (passes z=-6 at end)
    const deg=th*180/Math.PI;
    if(deg<360+extra){ const rate=(deg>floatSpan[0]&&deg<floatSpan[1])?floatRate:v/R*180/Math.PI; th+=rate*Math.PI/180*dt; }
    const a=Math.min(th,2*Math.PI); const pos=v3(0,2.2-R*Math.cos(a),-6-R*Math.sin(a));
    if(th>=2*Math.PI){ s+=v*dt; pos.z-=s; }
    // maverick: same path, but the quad stays facing forward and upright (pitch back a bit, then forward)
    const q = mav ? qaxis(X, 0.6*Math.sin(Math.min(a,2*Math.PI)/2)) : qaxis(X, th);
    return {pos,q}; }; }
run('powerloop, steady', loop({floatRate:263}), 4, ['Powerloop']);
run('powerloop, floats 0.6 s over the top (60°/s)', loop({floatRate:60, floatSpan:[150,190]}), 5, ['Powerloop']);
run('powerloop, floats 1.0 s over the top (40°/s)', loop({floatRate:40, floatSpan:[160,200]}), 5, ['Powerloop']);
run('powerloop, keeps pitching 40° past the exit', loop({floatRate:80, floatSpan:[150,190], extra:40}), 5, ['Powerloop']);
run('maverick loop (stays upright, facing forward)', loop({mav:true}), 4, ['Maverick Loop']);
console.log(`\n${pass}/${total}`);
