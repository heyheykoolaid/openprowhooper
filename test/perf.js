require('../src/tricks.js'); require('../src/sim.js'); const S=globalThis.Sim;
const w=S.buildPlayground(), p=S.buildDrone(S.PRESETS['Air65 Racing']), d=new S.Drone(p,S.defaultTune(),w), det=new S.TrickDetector(w);
d.pos={x:-8,y:1,z:2}; d.armed=true; const t0=process.hrtime.bigint();
for(let i=0;i<5000;i++){ d.step({thr:0.42,roll:0.05,pitch:0.1,yaw:0},0.001); det.update(d,0.001); }
console.log('ms per simulated second:', Number(process.hrtime.bigint()-t0)/1e6/5, 'crashed',d.crashed, d.pos);
