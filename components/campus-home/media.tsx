import type {ImgHTMLAttributes} from 'react';
export type Asset=(filename:string)=>string;
export const localAsset:Asset=name=>'/assets/'+name;

// Native source dimensions: never label an enlarged thumbnail as HD or 4K.
const images:Record<string,{width:number;height:number;small:number}>={
 'home-hd/school-day.webp':{width:1672,height:941,small:720},
 'home-hd/team-training.webp':{width:1672,height:941,small:720},
 'joy/next-chapter.webp':{width:1600,height:900,small:720},
 'joy/school.webp':{width:1536,height:1024,small:720},
 'joy/corporate.webp':{width:1536,height:1024,small:720},
 'joy/college.webp':{width:1600,height:900,small:720},
 'joy/teacher.webp':{width:1600,height:900,small:720},
 'joy/beyond-classroom.webp':{width:1600,height:900,small:720},
 'joy/learning-together.webp':{width:1000,height:1500,small:600},
 'home-hd/campus-community.webp':{width:1672,height:941,small:720},
 'home-hd/creator-assessment.webp':{width:1672,height:941,small:720},
};
type HomeImageProps=Omit<ImgHTMLAttributes<HTMLImageElement>,'src'|'srcSet'> & {name:string;asset:Asset;fullResolution?:boolean};
export function HomeImage({name,asset,fullResolution=false,sizes='100vw',loading='lazy',...props}:HomeImageProps){
 const info=images[name];
 const srcSet=info&&!fullResolution?`${asset(name.replace('.webp','-small.webp'))} ${info.small}w, ${asset(name)} ${info.width}w`:undefined;
 return <img width={info?.width} height={info?.height} {...props} src={asset(name)} srcSet={srcSet} sizes={srcSet?sizes:undefined} loading={loading} decoding="async"/>;
}
export function Photo({name,alt,asset,priority=false,className='',fullResolution=false}:{name:string;alt:string;asset:Asset;priority?:boolean;className?:string;fullResolution?:boolean}){
 return <picture className={className}><HomeImage name={name.includes('/')?name:'joy/'+name+'.webp'} alt={alt} asset={asset} fullResolution={fullResolution} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'}/></picture>;
}
