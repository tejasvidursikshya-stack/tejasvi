import { PDFDocument,PDFDict,PDFName,PDFArray } from 'pdf-lib';
import { unzipSync,strFromU8 } from 'fflate';
export async function validatePDF(bytes:Uint8Array){
 const pdf=await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false});
 if(!pdf.getPageCount()||pdf.getPageCount()>500)throw new Error('PDF must contain 1–500 pages.');
 const blocked=new Set(['JavaScript','JS','AA','Launch','EmbeddedFiles','EmbeddedFile','RichMedia','XFA','SubmitForm','ImportData']);
 const seen=new Set<object>();
 function inspect(value:unknown){
  if(value instanceof PDFName && blocked.has(value.decodeText()))throw new Error('Active content and embedded files are not supported. Export a plain PDF.');
  if(value instanceof PDFDict || value instanceof PDFArray){
   if(seen.has(value))return;seen.add(value);
   if(value instanceof PDFDict)for(const [key,item] of value.entries()){inspect(key);inspect(item)}
   else for(const item of value.asArray())inspect(item);
  }
 }
 for(const [,object] of pdf.context.enumerateIndirectObjects()){
  inspect(object);if(object && typeof object==='object' && 'dict' in object)inspect(object.dict);
 }
}
export const printerPart=(path:string)=>/^ppt\/printerSettings\/printerSettings[0-9]+\.bin$/.test(path);
export function validateOffice(bytes:Uint8Array,kind:'pptx'|'docx',stripPrinter=false){
 let expanded=0,count=0,printer=false;
 const main=kind==='pptx'?'ppt/presentation.xml':'word/document.xml';
 const files=unzipSync(bytes,{filter:e=>{
  expanded+=e.originalSize;count++;
  if(count>3000||expanded>80*1024*1024||e.originalSize>30*1024*1024)throw new Error('Document expands beyond the supported size.');
  if(stripPrinter&&kind==='pptx'&&printerPart(e.name)){printer=true;return false;}
  if(/vbaproject|\.bin$|(?:^|\/)embeddings\//i.test(e.name))throw new Error('Macros and embedded executable content are not supported.');
  return e.name==='[Content_Types].xml'||e.name===main;
 }});
 const types=files['[Content_Types].xml'];
 if(!files[main]||!types||!strFromU8(types).includes(kind==='pptx'?'presentationml':'wordprocessingml')||/macroEnabled|vbaProject/i.test(strFromU8(types)))throw new Error('Invalid or macro-enabled Office document.');
 return printer;
}
export async function validateLessonFile(bytes:Uint8Array,name:string){
 const ext=name.toLowerCase().split('.').pop();
 if(ext==='pdf')await validatePDF(bytes);
 else if(ext==='docx')validateOffice(bytes,'docx');
 else if(ext==='txt'){
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(/[\x00-\x08\x0b\x0e-\x1f]/.test(text))throw new Error('Choose a plain UTF-8 text file.');
 }else throw new Error('Upload a PDF, DOCX or plain text file. Convert older DOC files to PDF first.');
 return ext;
}
