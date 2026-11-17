# Rebuilds calibration/demos/ from extracted GIF frames + gif_rotation.py output (paths are this machine's; adjust G).
# Build calibration/demos/*.json from the measured GIF frames (derived data only; the GIFs are not committed).
import json, math, os, sys
G = '/home/claude/gifs'; OUT = '/home/claude/openprowhooper/calibration/demos'
C = [  # dir, trick (spreadsheet name), source file as received, real ms per frame, object used
 ('1-flip','Flip','1000036033.webp',40,'garage, open air'), ('2-double-flip','Double Flip','1000040858.webp',40,'backyard'),
 ('3-roll','Roll','1000036034.webp',43,'at the pilot'), ('4-double-roll','Double Roll','1000040851.gif',33,'backyard'),
 ('5-segmented','Segmented Flips/Rolls','1000036121.gif',38,'street'), ('6-yaw-spin','Yaw Spin','1000036035.gif',40,'through an LED cube'),
 ('7-inverted-rewind','Invert Rewind','1000040859.webp',40,'backyard'), ('8-vanny-roll','Vanny Roll','1000036119.gif',31,'street'),
 ('9-rubiks-cube',"Rubik's Cube",'1000036117.gif',33,'street'), ('10-cubiks-rube',"Cubik's Rube",'1000036115.gif',35,'street'),
 ('11-juicy-flick','Juicy Flick','1000036113.gif',34,'sidewalk'), ('12-snapback','Snapback','1000036111.gif',31,'under a tree'),
 ('13-inverted-yaw-spin','Inverted Yaw Spin','1000036107-1.gif',43,'street'), ('14-inverted-yaw-tracking','Inverted Yaw Tracking','1000036105.gif',42,'tree'),
 ('16-immelmann','Immelmann Turn','1000036040.webp',38,"through the pilot's legs"), ('17-power-split','Power Split','Power-Split.gif',40,'tree'),
 ('18-power-flip','Power Flip','1000036103.gif',42,'tree'), ('19-reversed-power-flip','Reversed Power Flip','1000037616.gif',33,'indoor cube'),
 ('20-power-swap','Power Swap','1000039815.gif',31,"through the pilot's legs"), ('21-power-switch','Power Switch','1000036096-1.gif',40,'tree'),
 ('22-power-roll','Power Roll','1000036088.webp',38,'tree'), ('23-loop-to-matty','Loop to Matty','1000037609.gif',27,'indoor cube (not in spreadsheet)'),
 ('24-inverted-360-powerloop','Inverted 360 Powerloop','1000036100.gif',38,'tree'), ('25-barani','Barani','1000036094.webp',38,'tree'),
 ('26-maverick-loop','Maverick Loop','1000036092.webp',41,'tree'), ('27-mavvy-roll','Mavvy Roll','1000036090.webp',40,'tree'),
 ('28-half-mavvy','Half Mavvy','1000036044.webp',40,'indoor gate tower'), ('29-maviks-loop',"Mavik's Loop",'1000037087.gif',33,'living room'),
 ('30-powerloop','Powerloop','powerloop.gif',None,'tall statue in a fountain (timing unknown)'), ('31-mavani','Mavani','Mavani.gif',40,'tree'),
 ('32-donkey-loop','Donkey Loop','1000036086.webp',40,'tree'), ('33-beginner-matty','Beginner Matty','1000036045.webp',40,'chair'),
 ('34-matty-flip','Matty Flip','1000036187.gif',32,'gap between two cars'), ('35-matty-twister','Matty Twister','1000040852.webp',32,'tree branch'),
 ('36-half-matty','Half Matty','1000039645.gif',32,"through the pilot's legs"), ('37-540-half-matty','540 Half Matty','1000036080.webp',32,'tree'),
 ('38-matty-360','Matty 360','1000036046.webp',32,'indoor gate'), ('39-forani','Forani','Screen_Recording_20230925_090343_YouTube_AdobeExpress.webp',40,'the pilot (park)'),
 ('40-split-s','Split-S','1000036098.gif',40,'tree'), ('41-540-split-s','540 Split S','1000044751.gif',None,'tree branch (~3-4x slow-mo GIF)'),
 ('42-splitback','Split-Back','1000040861.webp',32,'gazebo'), ('43-split-yaw','Split Yaw','1000040864.webp',32,'gazebo'),
 ('44-split-stall-matty-rewind','Split Stall Matty Rewind','1000040882.webp',32,'gazebo'), ('45-orbits','Orbit x2','1000036074.webp',34,'tree'),
 ('46-cradle','Cradle','1000036050.webp',40,'the pilot'), ('47-side-lock-rewind','Side-Lock Rewind','1000040460.gif',32,'the pilot'),
 ('48-whiplash','Whiplash','1000036078.webp',32,'tree'), ('49-pole-dance','Pole Dance','f89bc02f-6a33-4050-b591-abb7da78f24a-1.webp',32,'tree'),
 ('50-trippy-spin','Trippy Spin x2','1000040862.webp',32,'tree'), ('51-trippy-switch','Trippy Switch','Trippy-Switch.webp',40,'tree trunk'),
 ('52-double-rolling-trippy','Double Rolling Trippy Spin','1000036053.webp',40,'tree trunk'), ('53-jump-rope','Jump Rope','1000040880.webp',32,'indoor striped pole'),
 ('54-cinnamon-roll','Cinnamon Roll','1000039099.gif',32,'indoor striped pole'), ('55-burrito-roll','Burrito Roll','1000040856.webp',40,'play structure slide'),
 ('56-side-loop','Side Loop','1000040855.webp',40,'play structure slide'), ('57-double-dutch','Double Dutch','1000040874.webp',32,'indoor cube'),
 ('58-stall-flip-rewind','Flip Stall Rewind','1000039819.gif',32,'indoor staircase'), ('59-stall-360-rewind','360 Stall Rewind','1000036191.gif',40,'the pilot'),
 ('60-stall-matty-rewind','Matty Stall Rewind','1000039660.gif',40,'tree'), ('61-stall-half-matty-rewind','Half Matty Stall Rewind','Screen_Recording_20230922_152116_YouTube_2_AdobeExpress.webp',40,'the pilot'),
 ('62-building-dive','Dive','1000036177.gif',40,'apartment building'), ('63-wall-ride','Wall Ride','1000036076.webp',32,'garage door'),
 ('64-wall-tap','Wall Tap','1000036169.gif',32,'garage wall'), ('65-roll-tap','Roll Tap','1000040867.webp',32,'fence'),
 ('66-loop-tap','Loop Tap','1000040865.webp',32,'fence'), ('67-ceiling-tap','Ceiling Tap','1000036165-1.gif',32,'hallway ceiling'),
 ('68-reverse-wall-ride','Reverse Wall Ride','1000040854.webp',32,'house wall'),
 ('69-downtown-tap','Downtown Tap','1000040866.webp',32,'house wall'), ('70-maverick-tap-rewind','Maverick Tap Rewind','1000037666-1.gif',33,'indoor beam'),
 ('71-power-switch-tap','Power Switch Tap','1000036172.gif',33,'indoor beam'), ('72-reverse-knife-edge','Reverse Knife Edge','1000039644.gif',33,'indoor gate'),
 ('73-ninja-star','Ninja Star','1000036209.gif',33,'gap between two tree trunks'), ('74-eject-roll','Eject Roll','1000040888.webp',32,'indoor cube (~1 m)'),
 ('75-blind-loop','Blindflip','1000036082-3.webp',32,'tree (site name: Blind Loop)'), ('76-true-barani','True Barani','1000036084.webp',32,'tree'),
 ('77-stall-rewind','Stall Rewind','1000043091.webp',None,'house wall (frame timing unknown)'), ('78-beginner-switch','Beginner Switch','1000043083.webp',None,'gazebo (frame timing unknown)'),
]
def tilt(fr):   # camera uptilt from roll-dominant frames: body yaw ~ 0 during a roll
    num = den = 0.0
    for f in fr:
        if f and abs(f[0]) > 12 and abs(f[1]) < 0.4 * abs(f[0]) and abs(f[0]) > 1.3 * abs(f[2]): num += -f[2] * f[0]; den += f[0] * f[0]
    return round(math.degrees(math.atan2(num, den)), 1) if den > 2000 else None
index = []
for d, trick, src, ms, obj in C:
    v2 = f'{G}/{d}-rot2.json'
    if os.path.exists(v2):   # advanced pass (tools/gif_rotation2.py): blur bridging, lens choice, loop closure
        R2 = json.load(open(v2)); fr = R2['frames']; method = {'tool': 'gif_rotation2', 'hfov': R2['hfov'], 'closures': R2['closures']}
    else:
        rot = json.load(open(f'{G}/{d}-rot.json')); method = {'tool': 'gif_rotation', 'hfov': 140}
        fr = [None if r is None else [round(r['roll'], 1), round(r['pitch'], 1), round(r['yaw'], 1)] for r in rot]
    slug = d.split('-', 1)[1]
    rec = {'format': 'pro-whooper-demo/1', 'trick': trick, 'source': 'prowhooper.com Tricktionary demo GIF (Tyrantt / contributing pilots)', 'file': src,
           'object': obj, 'msPerFrame': ms, 'msPerFrameNote': 'real time per frame from the goggle OSD clock where visible; None = unknown',
           'axes': 'per-frame camera rotation in degrees [roll about the lens axis, pitch about camera right, yaw about camera up]; null = frame too blurred to match',
           'cameraTiltDeg': tilt(fr), 'measured': method, 'frames': fr}
    json.dump(rec, open(f'{OUT}/{slug}.json', 'w'), separators=(',', ':'))
    index.append({'trick': trick, 'file': f'{slug}.json', 'frames': len(fr), 'tracked': sum(1 for f in fr if f), 'msPerFrame': ms, 'cameraTiltDeg': rec['cameraTiltDeg'], 'object': obj})
json.dump(index, open(f'{OUT}/index.json', 'w'), indent=1)
print(len(index), 'demos;', sum(i['frames'] for i in index), 'frames;', 'tilts:', [i['cameraTiltDeg'] for i in index if i['cameraTiltDeg'] is not None][:20])
