import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chunks,deadTokens,freshItems,messagesFor,tokenPattern} from '../lib/mobile-push-rules.mjs';

const now=Date.parse('2026-11-06T12:00:00Z');
const item=(id,kind,at,read=false)=>({id,kind,at,read,title:'Graded: Essay 1',body:'85 / 100 · Strong argument.',target:'assessments',courseId:'c1'});

test('only unread, unsent, recent items are pushed; deadlines always qualify',()=>{
 const items=[item('a','feedback','2026-11-06T10:00:00Z'),item('b','feedback','2026-11-06T10:00:00Z',true),item('c','feedback','2026-11-06T10:00:00Z'),item('d','learning','2026-10-01T10:00:00Z'),item('e','due-soon','2026-11-07T10:00:00Z')];
 assert.deepEqual(freshItems(items,new Set(['c']),now).map(i=>i.id),['a','e']);
});

test('messages never carry marks or feedback text',()=>{
 const [m]=messagesFor(item('a','feedback','2026-11-06T10:00:00Z'),'org-1','United College',['ExponentPushToken[abcdefghijklmnop]']);
 assert.equal(m.title,'Graded: Essay 1');
 assert.equal(m.body,'United College · Open Tejasvi to see your feedback.');
 assert.ok(!JSON.stringify(m).includes('85'));
 assert.ok(!JSON.stringify(m).includes('Strong argument'));
 assert.deepEqual(m.data,{orgId:'org-1',target:'assessments',courseId:'c1',kind:'feedback'});
});

test('one message per device, deadlines are high priority',()=>{
 const ms=messagesFor(item('e','overdue','2026-11-01T10:00:00Z'),'o','',['ExponentPushToken[aaaaaaaaaaaa]','ExponentPushToken[bbbbbbbbbbbb]']);
 assert.equal(ms.length,2);assert.equal(ms[0].priority,'high');assert.equal(ms[1].to,'ExponentPushToken[bbbbbbbbbbbb]');
});

test('token format, batching and removal of uninstalled devices',()=>{
 assert.ok(tokenPattern.test('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'));
 assert.ok(!tokenPattern.test('ExponentPushToken[]'));assert.ok(!tokenPattern.test('https://evil.test'));
 assert.deepEqual(chunks([1,2,3,4,5],2),[[1,2],[3,4],[5]]);
 const msgs=[{to:'t1'},{to:'t2'},{to:'t3'}];
 assert.deepEqual(deadTokens(msgs,[{status:'ok'},{status:'error',details:{error:'DeviceNotRegistered'}},{status:'error',details:{error:'MessageTooBig'}}]),['t2']);
});
