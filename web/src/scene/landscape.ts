// Small authored things inside the shaded landscape. Every mark is an ASCII
// glyph in the same atlas as the raster, never a bitmap or an HTML overlay.
import { clamp, hash, Layer, noise, W, H } from './raster';
import type { Env } from './world';

function inscription(L: Layer, x: number, y: number, rows: string[]): void {
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
    if (rows[j][i] !== ' ') L.symbol(x + i, y + j, rows[j][i]);
  }
}

function stroke(L: Layer, x0: number, y0: number, x1: number, y1: number): void {
  const n = Math.max(Math.abs(x1-x0),Math.abs(y1-y0),1);
  const char = Math.abs(y1-y0) < Math.abs(x1-x0)*0.3 ? '_' : (x1-x0)*(y1-y0) >= 0 ? '\\' : '/';
  for (let i=0;i<=n;i++) L.symbol(Math.round(x0+(x1-x0)*i/n),Math.round(y0+(y1-y0)*i/n),char);
}

const SAND_PEAKS = [[0,31],[7,29],[15,32],[24,25],[29,29],[35,27],[44,33],[54,30],[64,31],[74,26],[80,29],[88,27],[99,32]];
const GRASS_PEAKS = [[0,30],[12,25],[26,28],[35,24],[49,29],[62,26],[76,29],[88,25],[99,30]];

export function distantTop(x: number, sand: boolean): number {
  const peaks = sand ? SAND_PEAKS : GRASS_PEAKS;
  let k=0;
  while (k<peaks.length-2 && peaks[k+1][0]<x) k++;
  const [ax,ay]=peaks[k], [bx,by]=peaks[k+1];
  return Math.round(ay+(by-ay)*(x-ax)/(bx-ax));
}

/** A distant, quiet band; it is clipped by the nearer dune instead of shining through it. */
export function distantRange(L: Layer, e: Env, nearTop: (x: number) => number): void {
  const peaks = e.sand ? SAND_PEAKS : GRASS_PEAKS;
  for (let x=0;x<W;x++) {
    let k=0;
    while (k<peaks.length-2 && peaks[k+1][0]<x) k++;
    const [ax,ay]=peaks[k], [bx,by]=peaks[k+1];
    const top=Math.round(ay+(by-ay)*(x-ax)/(bx-ax));
    const bottom=nearTop(x);
    for (let y=top;y<bottom;y++) {
      const depth=(y-top)/Math.max(1,bottom-top);
      const fold=noise(x*0.14,y*0.16,71);
      // Atmospheric perspective: the range dissolves into the horizon.
      L.set(x,y,clamp((0.42+fold*0.14)*(1-depth*0.62),0,1));
    }
    if (top<bottom && x%3!==2) L.symbol(x,top, x>ax+1 && by<ay ? '/' : by>ay ? '\\' : '_');
  }
}

function acacia(L: Layer, cx: number, ground: number, scale: number): void {
  // An uneven umbrella crown, open sky underneath and a visibly forked trunk.
  const top=ground-15*scale;
  const bend=cx+2*scale;
  stroke(L,cx,ground,bend,top+7*scale);
  stroke(L,cx+1,ground,bend+1,top+7*scale);
  stroke(L,bend,top+9*scale,cx-8*scale,top+3*scale);
  stroke(L,bend,top+7*scale,cx+10*scale,top+2*scale);
  stroke(L,cx-3*scale,top+6*scale,cx-12*scale,top+4*scale);
  stroke(L,cx+5*scale,top+5*scale,cx+13*scale,top+4*scale);
  const lobes=[[-9,3,7,1.8],[0,1.5,9,2.2],[9,3,7,1.7],[-3,4.1,10,1.3]];
  for (const [dx,dy,rx,ry] of lobes) {
    for(let y=Math.floor(top+(dy-ry)*scale);y<=top+(dy+ry)*scale;y++) {
      for(let x=Math.floor(cx+(dx-rx)*scale);x<=cx+(dx+rx)*scale;x++) {
        const u=(x-cx-dx*scale)/(rx*scale),v=(y-top-dy*scale)/(ry*scale);
        if(u*u+v*v>1 || hash(x*131+y*73)>0.86)continue;
        const glyph=hash(x*71+y*17)>0.65?'*':y<top+dy*scale?':':'%';
        L.symbol(x,y,glyph);
      }
    }
  }
  inscription(L,cx-3,ground+1,['__','  \\___']);
}

function pine(L: Layer, x: number, y: number, height: number): void {
  for(let row=0;row<height;row++) {
    const half=Math.round(row*0.43);
    for(let dx=-half;dx<=half;dx++) {
      if (Math.abs(dx)<half || row%3!==1) L.symbol(x+dx,y-height+row,dx===0?'|':dx<0?'/':'\\');
    }
  }
  L.symbol(x,y,'|'); L.symbol(x,y+1,'|');
}

/** Stable middle-ground landmarks. Nothing randomly respawns while you watch. */
export function grove(L: Layer, e: Env): void {
  if(e.sand) {
    acacia(L,16,47,0.95);
    acacia(L,86,39,0.45);
    inscription(L,73,45,['  ,',' \\|/','--|--','  |','_/ \\_']);
  } else {
    pine(L,13,44,17); pine(L,24,39,11); pine(L,84,42,15); pine(L,94,38,9);
    inscription(L,5,49,['   ,',' ,/|\\,','  \\|/',' ,/|\\,','  \\|/','___|___']);
    inscription(L,85,51,['  \\|/',' \\ | /','  \\|/','   |']);
  }
}

/** Sparse engravings and objects let the plain areas carry the sense of space. */
export function groundDetails(L: Layer, e: Env): void {
  // Broad contours of the near dunes, interrupted by open areas of sand.
  for(const [x0,y0,len] of [[0,43,19],[28,41,12],[77,42,23],[0,55,14],[73,56,21],[23,64,15]] ) {
    for(let k=0;k<len;k++) {
      const y=Math.round(y0+Math.sin(k/len*Math.PI)*1.1);
      if(k%7!==5) L.symbol(x0+k,y,k===0?',':k===len-1?'.':'_');
    }
  }
  // A dry wadi / meadow hollow recedes towards the right-hand ridge.
  for(let y=41;y<H;y++) {
    const z=(y-40)/(H-40);
    const x=Math.round(64+z*z*26+Math.sin(z*5)*4);
    if(y%3!==1) L.symbol(x,y,e.sand?'.':',');
    if(z>0.3 && y%4===0)L.symbol(x+Math.round(z*7),y,'_');
  }
  // Three pebbles and an old little cairn, drawn with purposeful contour marks.
  inscription(L,80,48,['    __','   /::\\',' __\\__/__','/.:/  \\:.\\','\\__\\__/__/']);
  inscription(L,7,59,['  __',' /:.\\_',' \\___/']);
  inscription(L,30,61,[' _','(_ )']);
  inscription(L,90,56,[' __','/._\\']);
  // A few paired tracks belong to the world, not to the person's location.
  for(let i=0;i<6;i++) {
    const x=30+i*2, y=48+Math.floor(i*1.1);
    L.symbol(x,y,'.');L.symbol(x+2,y+1,"'");
  }
}

/** Near silhouettes frame the clearing without covering the creature or its face. */
export function foreground(L: Layer, e: Env): void {
  inscription(L,1,58,[
    '       /',
    '  \\   /  ,',
    '   \\ /  /',
    ' \\  | /',
    '  \\ |/  /',
    '  __\\|__/__',
    '    /|\\',
    ' __/ | \\___',
    '     |'
  ]);
  inscription(L,87,58,[
    '   ,    /',
    '   |  /',
    ' \\ | / _/',
    '  \\|/ /',
    ' ___|_/',
    '  / | \\_',
    ' /  |',
    '___/ \\____'
  ]);
  // Tiny rosette and seed pod. These remain small discoveries, not UI icons.
  inscription(L,70,63,e.sand?[' ,_','(o )',' \\|/']:[' \\|/','--*--',' /|\\','  |']);
  inscription(L,19,65,[' ,','/o\\',' \\/']);
  for(const [x,y] of [[36,66],[60,64],[78,66],[5,66]]) {
    L.symbol(x,y,','); L.symbol(x+1,y,'_'); L.symbol(x+3,y,'.');
  }
}
