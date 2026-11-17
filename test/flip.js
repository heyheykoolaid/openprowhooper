require('../src/tricks.js'); require('../src/sim.js'); const S=globalThis.Sim;
const w=S.buildPlayground(), p=S.buildDrone(S.PRESETS['Air65 Racing']); const d=new S.Drone(p,S.defaultTune(),w), det=new S.TrickDetector(w), sk=new S.ScoreKeeper();
d.pos={x:0,y:4,z:6}; d.vel={x:0,y:0,z:-2}; d.armed=true;
const st=(n,rc)=>{for(let i=0;i<n;i++){d.step(rc,0.001); det.update(d,0.001,rc);}};
st(300,{thr:0.4,roll:0,pitch:0,yaw:0});
// pilot-ish: full stick until 300 deg rotated, then release
const fl=(axis,sign)=>{let a=0,n=0; while(a<330&&n<2000){ const rc={thr:0.5,roll:0,pitch:0,yaw:0}; rc[axis]=sign; d.step(rc,0.001); det.update(d,0.001,rc); const r=d.pilotRates(); a+=Math.abs(axis==='roll'?r[0]:r[1])*0.001; n++;} st(900,{thr:0.42,roll:0,pitch:0,yaw:0}); return n;};
console.log('flip ms',fl('pitch',-1),'upY',d.up().y.toFixed(2),'y',d.pos.y.toFixed(2));
console.log('roll ms',fl('roll',1),'upY',d.up().y.toFixed(2),'y',d.pos.y.toFixed(2));
console.log(det.drain().map(e=>{const r=sk.add(e); return e.name+' '+e.exec+' '+e.clean+' +'+(r&&r.net)}));
