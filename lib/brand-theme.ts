export type Brand={id:string;name:string;kind?:string;platformName?:string;primaryColor?:string;accentColor?:string;welcomeText?:string;hasLogo?:boolean|number;brandingVersion?:number};
export const brandName=(b:Brand)=>b.platformName||b.name;
export const logoUrl=(b:Brand)=>`/api/branding/${b.id}?v=${b.brandingVersion||0}`;
export function color(value:string|undefined,fallback:string){return /^#[0-9a-f]{6}$/i.test(value||'')?value!:fallback}
function luminance(hex:string){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722}
export function contrastText(hex:string){const light=luminance(hex);if(1.05/(light+.05)>=4.5)return '#ffffff';if((light+.05)/(luminance('#101820')+.05)>=4.5)return '#101820';return '#000000'}
export const TEJASVI_PRIMARY='#063868';
export const TEJASVI_ACCENT='#ff7800';

// Public pages and organization workspaces share this semantic palette.
// Keep the default :root values in globals.css in sync with this function.
export function themeValues(b:Brand){
 const primary=color(b.primaryColor,TEJASVI_PRIMARY),accent=color(b.accentColor,TEJASVI_ACCENT);
 const onPrimary=contrastText(primary),onAccent=contrastText(accent);
 const mix=(value:string,amount:number,base='white')=>`color-mix(in srgb, ${value} ${amount}%, ${base})`;
 const ink=onPrimary==='#ffffff'?primary:mix(primary,40,'#101820');
 return {
  '--navy':primary,'--orange':accent,'--brand-primary':primary,'--brand-accent':accent,
  '--brand-on-primary':onPrimary,'--brand-on-accent':onAccent,
  '--brand-on-primary-muted':mix(onPrimary,78,primary),
  '--brand-ink':ink,'--brand-muted':'#536678',
  '--brand-subtle':mix(primary,2),'--brand-soft':mix(primary,6),
  '--brand-mid':mix(primary,13),'--brand-line':mix(primary,13),
  '--brand-line-strong':mix(primary,28),'--brand-blue':mix(primary,65),
  '--brand-primary-hover':mix(primary,88,'#101820'),
  '--brand-accent-subtle':mix(accent,4),'--brand-accent-soft':mix(accent,12),
  '--brand-accent-mid':mix(accent,28),'--brand-accent-strong':mix(accent,55,'#101820'),
  '--brand-accent-hover':mix(accent,90),'--brand-focus':ink,
  '--background':'#ffffff','--foreground':ink,'--card':'#ffffff','--card-foreground':ink,
  '--popover':'#ffffff','--popover-foreground':ink,
  '--primary':primary,'--primary-foreground':onPrimary,
  '--secondary':mix(primary,6),'--secondary-foreground':ink,
  '--muted':mix(primary,2),'--muted-foreground':'#536678',
  '--accent':mix(accent,12),'--accent-foreground':ink,
  '--border':mix(primary,13),'--input':mix(primary,28),'--ring':ink,
  '--ink':ink,'--body':'#536678','--line':mix(primary,13),
  '--sidebar':'#ffffff','--sidebar-foreground':ink,
  '--sidebar-primary':primary,'--sidebar-primary-foreground':onPrimary,
  '--sidebar-accent':mix(primary,6),'--sidebar-accent-foreground':ink,
  '--sidebar-border':mix(primary,13),'--sidebar-ring':ink,
 };
}
