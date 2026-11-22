import type { MetadataRoute } from 'next';
import { siteOrigin,publicIndexing } from '@/lib/seo';
export default function robots():MetadataRoute.Robots {
 // Let crawlers read noindex on private URLs; authentication protects the data.
 return {rules:{userAgent:'*',allow:'/'},...(publicIndexing ? {sitemap:siteOrigin+'/sitemap.xml'} : {})};
}
