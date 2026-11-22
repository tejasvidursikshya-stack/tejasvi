import type { Metadata } from 'next';
export const siteOrigin = new URL(process.env.APP_URL || 'http://localhost:3000').origin;
export const publicIndexing = process.env.INDEX_PUBLIC_SITE === 'true';
export function publicMetadata(title:string,description:string,path:string):Metadata {
 return {title,description,alternates:{canonical:new URL(path,siteOrigin).href},robots:{index:publicIndexing,follow:publicIndexing},openGraph:{type:'website',siteName:'Tejasvi',title,description,url:new URL(path,siteOrigin).href,images:[{url:'/social-card.png',width:1200,height:630,alt:'Tejasvi — Learning made simple'}]},twitter:{card:'summary_large_image',title,description,images:['/social-card.png']}};
}
