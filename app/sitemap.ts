import type { MetadataRoute } from 'next';
import { siteOrigin,publicIndexing } from '@/lib/seo';
export default function sitemap():MetadataRoute.Sitemap {
 return publicIndexing ? ['/', '/schools'].map(path=>({url:siteOrigin+path})) : [];
}
