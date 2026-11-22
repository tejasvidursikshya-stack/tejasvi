import CampusHome from '@/components/campus-home/home';
import './campus-home.css';
import {publicMetadata,siteOrigin} from '@/lib/seo';
export const metadata=publicMetadata('Tejasvi Campus | EMIS, Learning & AI Creator','Try a school, college or corporate product demo and request a guided walkthrough of Tejasvi Campus.','/');
export default function Page(){
 const schema={'@context':'https://schema.org','@graph':[
  {'@type':'Organization','@id':siteOrigin+'/#organization',name:'Tejasvi',url:siteOrigin,logo:siteOrigin+'/assets/tejasvi-campus-logo.svg'},
  {'@type':'WebSite','@id':siteOrigin+'/#website',name:'Tejasvi Campus',url:siteOrigin,publisher:{'@id':siteOrigin+'/#organization'}}]};
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/><CampusHome/></>;
}
