import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gammaThemes,submitGamma,pollGamma,exportBytes,gammaURL} from '../lib/gamma-client.mjs';
const key='test-only',id='g_test-id',b={title:'Java objects',audience:'BCA',notes:'Trace two examples.',cards:8,language:'en',images:false};
test('provider protocol, private sharing, safe key check, polling is a read',async t=>{
 const seen=[];t.mock.method(globalThis,'fetch',async(raw,opts)=>{const u=new URL(raw);seen.push({u,opts});assert.equal(u.origin,'https://public-api.gamma.app');assert.equal(opts.headers['X-API-KEY'],key);return Response.json(u.pathname.endsWith('/themes')?{data:[{id:'theme_school',name:'School'}],hasMore:false}:opts.method==='POST'?{generationId:id}:{generationId:id,status:'completed',gammaUrl:'https://gamma.app/docs/lesson',exportUrl:'https://exports.gamma.app/lesson.pptx',credits:{deducted:5}});});
 assert.equal((await gammaThemes(key,true)).themes[0].id,'theme_school');await submitGamma(key,b,'theme_school');const got=await pollGamma(key,id);assert.equal(got.credits,5);assert.equal(got.state,'ready');assert.deepEqual(seen.map(x=>x.opts.method),['GET','POST','GET']);const body=JSON.parse(seen[1].opts.body);assert.deepEqual(body.sharingOptions,{externalAccess:'noAccess',workspaceAccess:'noAccess'});assert.equal(body.exportAs,'pptx');assert.equal(body.imageOptions.source,'noImages');assert.equal(body.themeId,'theme_school');
});
test('unknown host, credentials, redirects to other services and oversized exports are never downloaded',async t=>{
 for(const value of ['http://gamma.app/x','https://gamma.app.evil.test/x','https://key@gamma.app/x','http://127.0.0.1'])assert.equal(gammaURL(value),'');
 let calls=0;t.mock.method(globalThis,'fetch',async(raw,opts)=>{calls++;assert.equal(opts.headers,undefined);assert.equal(opts.redirect,'manual');return calls===1?new Response(null,{status:302,headers:{location:'http://127.0.0.1/secret'}}):new Response('test',{headers:{'content-length':String(21*1024*1024)}});});
 await assert.rejects(exportBytes('https://unlisted.gamma.app/file'));assert.equal(calls,0);await assert.rejects(exportBytes('https://exports.gamma.app/tmp'));await assert.rejects(exportBytes('https://exports.gamma.app/large'));assert.equal(calls,2);
});
test('lost or malformed POST responses are uncertain, rejected keys/credits are actionable, status IDs must match',async t=>{
 let mode='network';t.mock.method(globalThis,'fetch',async()=>{if(mode==='network')throw Error('private provider detail');if(mode==='key')return Response.json({private:'test'},{status:401});if(mode==='credits')return Response.json({code:'insufficient_credits'},{status:403});return Response.json({generationId:mode==='wrong'?'another':null,status:'completed'});});
 await assert.rejects(submitGamma(key,b),e=>e.ambiguous&&!e.message.includes('private'));mode='missing';await assert.rejects(submitGamma(key,b),e=>e.ambiguous);mode='key';await assert.rejects(gammaThemes(key),/rejected its API key/);mode='credits';await assert.rejects(submitGamma(key,b),/no credits/);mode='wrong';await assert.rejects(pollGamma(key,id),/did not confirm/);
});
