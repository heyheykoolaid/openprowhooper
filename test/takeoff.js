require('../src/tricks.js'); require('../src/sim.js'); const S=globalThis.Sim;
const w=S.buildPlayground(), p=S.buildDrone(S.PRESETS['Air65 Racing']);
for (const thr of [0.3,0.45,0.6,1]){ const d=new S.Drone(p,S.defaultTune(),w); d.armed=true;
 for(let i=0;i<1500;i++) d.step({thr,roll:0,pitch:0,yaw:0},0.001);
 console.log('thr',thr,'y after 1.5s',d.pos.y.toFixed(2),'crashed',d.crashed,d.crashReason||'', 'up',d.up().y.toFixed(2));}
