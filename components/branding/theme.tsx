'use client';
import { useEffect } from 'react';
import { brandName,logoUrl,themeValues,color,type Brand } from '@/lib/brand-theme';
export function BrandTheme({brand}:{brand:Brand|null}){
 useEffect(()=>{if(!brand)return;const oldTitle=document.title;document.title=brandName(brand);const links=Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="icon"],link[rel="shortcut icon"]'));const old=links.map(l=>[l,l.href,l.type] as const);for(const l of links){l.href=brand.hasLogo?logoUrl(brand):'/school-icon.svg';l.type=brand.hasLogo?'image/webp':'image/svg+xml'}return ()=>{document.title=oldTitle;for(const [l,href,type] of old){l.href=href;l.type=type}}},[brand]);
 useEffect(()=>{if(!brand)return;const manifest=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');const theme=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');const previousManifest=manifest?.getAttribute('href');const previousTheme=theme?.content;if(manifest)manifest.href='/api/mobile-manifest?org='+encodeURIComponent(brand.id);if(theme)theme.content=color(brand.primaryColor,'#063868');return()=>{if(manifest&&previousManifest)manifest.setAttribute('href',previousManifest);if(theme&&previousTheme)theme.content=previousTheme}},[brand]);
 return brand?<style>{`:root{${Object.entries(themeValues(brand)).map(([k,v])=>`${k}:${v}`).join(';')}}`}</style>:null;
}
export function BrandMark({brand,href}:{brand:Brand|null;href:string}){return <a className="brand school-brand" href={href}>{brand?.hasLogo?<img src={logoUrl(brand)} alt={`${brand.name} logo`} width="148" height="64"/>:brand?<span className="school-monogram" aria-hidden="true">{brand.name.slice(0,2).toUpperCase()}</span>:null}<span>{brand?brandName(brand):'Learning platform'}</span></a>}
