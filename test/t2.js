require('../src/tricks.js'); require('../src/sim.js');
const S=globalThis.Sim; const world=S.buildPlayground();
const p=S.buildDrone(S.PRESETS['Air65 Racing']); const tune=S.defaultTune();
const d=new S.Drone(p,tune,world); d.pos.y=2; d.armed=true;
for(let i=0;i<3000;i++){ d.step({thr:0.44,roll:0,pitch:0,yaw:0},0.001); if(i%250==0) console.log(i, d.pos.y.toFixed(2), d.vel.y.toFixed(2), d.up().y.toFixed(3), d.pilotRates().map(x=>x.toFixed(0)).join(','), d.thrust.map(x=>(x/9.81*1000).toFixed(1)).join(','), d.washLevel.toFixed(2));}
