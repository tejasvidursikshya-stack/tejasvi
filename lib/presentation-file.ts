import {unzipSync,zipSync,strToU8,strFromU8} from 'fflate';
import { validatePDF,validateOffice,printerPart } from './document-file.ts';
export async function validatePresentation(bytes:Uint8Array,name:string){
 if(!bytes.length||bytes.length>20*1024*1024)throw new Error('Choose a presentation smaller than 20 MB.');
 const kind=name.toLowerCase().split('.').pop();
 if(kind==='pdf'){await validatePDF(bytes);return 'pdf' as const}
 if(kind==='pptx'){validateOffice(bytes,'pptx');return 'pptx' as const}
 throw new Error('Upload a PDF slide deck or a PPTX file.');
}

// Some Office exporters include a binary print-driver profile. Omit only that
// optional device metadata; the strict normal validator still checks the result.
export function portablePowerPoint(input:Uint8Array){
 if(!input.length||input.length>20*1024*1024)throw new Error('PowerPoint must be at most 20 MB.');
 if(!validateOffice(input,'pptx',true))return input;
 const z=unzipSync(input,{filter:e=>!printerPart(e.name)});
 for(const name of Object.keys(z)){
  if(!name.endsWith('.rels')&&name!=='[Content_Types].xml')continue;
  const xml=strFromU8(z[name]);const clean=xml.replace(/<(?:[\w.-]+:)?(?:Relationship|Default|Override)\b[^<>]*\/\s*>/g,tag=>
   /\bType=["'](?:https?:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships|https?:\/\/purl\.oclc\.org\/ooxml\/officeDocument\/relationships)\/printerSettings["']/.test(tag)||/\bContentType=["']application\/vnd\.openxmlformats-officedocument\.presentationml\.printerSettings["']/.test(tag)?'':tag);
  if(clean!==xml)z[name]=strToU8(clean);
 }
 const portable=zipSync(z,{level:3});if(portable.length>20*1024*1024)throw new Error('Portable PowerPoint exceeds the file size limit.');validateOffice(portable,'pptx');return portable;
}
