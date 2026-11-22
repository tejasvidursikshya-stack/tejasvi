import type {CSSProperties} from 'react';

/* An original single-line pen alphabet. Paths are drawn in writing order;
   unknown characters keep normal, selectable text rather than losing a glyph. */
type Glyph=readonly [number,...string[]];
const pen:Record<string,Glyph>={
 ' ':[14],'.':[9,'M3 43l.7-.6'],
 O:[39,'M30 14C21 11 6 24 5 37C4 47 15 49 24 42C36 32 41 14 34 10C27 6 17 13 17 22C17 29 28 32 39 29'],
 a:[24,'M0 39Q7 34 10 29C18 22 23 27 19 35C16 42 8 45 7 40C5 35 12 28 19 28L16 38Q12 49 24 39'],
 b:[23,'M0 39C9 30 22 7 16 8C8 8 4 35 5 41C8 35 17 26 20 30C22 33 14 45 8 43Q14 46 23 39'],
 c:[19,'M0 39Q7 34 11 29C18 24 21 28 17 31C12 27 5 35 6 40Q8 48 19 39'],
 d:[26,'M0 39Q9 28 15 28C23 27 19 37 12 41C6 45 3 40 8 34Q13 27 20 29C26 18 30 7 26 8C21 10 13 34 16 41Q18 46 26 39'],
 e:[18,'M0 39C8 36 18 30 14 27C10 24 3 34 5 40Q8 48 18 39'],
 f:[19,'M0 39C13 30 23 9 17 9C10 9 6 30 4 47C2 61 7 60 9 51Q11 44 6 41Q13 42 19 38','M2 31Q11 29 18 30'],
 g:[25,'M0 39C10 27 21 23 20 31C17 39 10 44 7 41C3 36 14 26 21 28L13 51C8 66 1 60 8 52Q16 44 25 39'],
 h:[26,'M0 39C11 29 24 8 17 8C10 8 4 33 3 43C10 33 17 25 20 29Q21 31 16 39Q14 48 26 39'],
 i:[14,'M0 39L8 29Q3 39 5 42Q7 46 14 39','M10 19l1-1'],
 j:[15,'M0 39Q10 31 12 28L6 51C0 66 -8 58 1 50Q10 43 15 39','M15 19l1-1'],
 k:[25,'M0 39C12 27 22 8 16 9C10 10 5 29 3 43M6 38Q17 24 19 28C20 32 13 36 8 36Q16 49 25 39'],
 l:[17,'M0 39C12 27 26 7 18 7C10 7 2 32 4 40Q6 49 17 39'],
 m:[36,'M0 39L10 28Q12 27 6 42C14 32 22 23 22 29L16 42C23 33 32 24 31 30L26 40Q26 46 36 39'],
 n:[25,'M0 39Q8 31 11 28L6 42C13 34 21 24 22 29Q23 31 18 39Q16 48 25 39'],
 o:[22,'M0 39Q7 32 11 28C17 24 21 28 17 35C13 44 5 45 6 38C6 33 11 29 15 28C12 32 15 35 22 33'],
 p:[24,'M0 39L12 27L3 57M8 39C15 29 25 24 22 32C20 39 11 45 9 42Q16 46 24 39'],
 q:[25,'M0 39C9 28 23 23 19 33C16 41 8 45 6 41C4 35 14 27 21 28L13 56Q18 46 25 39'],
 r:[18,'M0 39Q8 33 12 27C9 28 8 32 12 33L16 31Q10 39 12 42Q14 44 18 39'],
 s:[18,'M0 39Q8 32 13 25C10 33 17 34 12 40Q7 46 4 42Q11 46 18 39'],
 t:[18,'M0 39C7 32 16 17 18 14C13 24 4 38 6 42Q9 47 18 39','M3 28Q13 26 22 27'],
 u:[26,'M0 39Q7 32 11 28C7 35 3 45 10 42Q17 39 22 28L18 39Q15 47 26 39'],
 v:[24,'M0 39L10 28Q5 42 10 43C16 44 23 29 19 27C16 27 17 34 24 33'],
 w:[33,'M0 39L10 28Q3 44 10 42Q16 39 19 30C16 37 15 44 21 42C26 39 33 28 28 27C26 28 27 34 33 33'],
 x:[23,'M0 39C11 26 14 26 12 34Q9 48 23 39','M6 43Q14 34 22 27'],
 y:[25,'M0 39L10 28C5 38 4 45 11 41Q18 37 22 28L14 50C7 67 0 60 8 52Q16 44 25 39'],
 z:[23,'M0 39C7 31 13 26 17 28Q19 31 10 36C19 32 21 39 13 48C5 59 0 56 6 50Q14 44 23 39']
};
export function Handwriting({text}:{text:string}){
 const letters=Array.from(text);if(letters.some(c=>!(c in pen)))return <em className="th-script-fallback" aria-hidden="true">{text}</em>;
 let x=0,units=0;const strokes:{x:number;d:string;start:number;len:number}[]=[];
 for(const char of letters){const [advance,...paths]=pen[char];for(const [j,d] of paths.entries()){const len=j===0?advance:5;strokes.push({x,d,start:units,len});units+=len;}if(!paths.length)units+=5;x+=advance;}
 const mult=Math.min(8,1500/(units||1)),width=x+18;
 return <svg className="th-writing" width={width} height="66" viewBox={'0 0 '+width+' 66'} aria-hidden="true" focusable="false"><g transform="translate(11 0) skewX(-9)" stroke="currentColor" fill="none" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">{strokes.map((s,i)=><path key={i} transform={'translate('+s.x+' 0)'} pathLength="1" d={s.d} style={{'--after':(180+s.start*mult)+'ms','--draw':Math.max(52,s.len*mult)+'ms'} as CSSProperties}/>)}</g></svg>;
}
