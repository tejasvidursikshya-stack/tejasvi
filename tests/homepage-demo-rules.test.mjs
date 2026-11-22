import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentError,resultError,canComplete} from '../components/campus-home/demo-rules.ts';
test('sample receipts reject overdrafts and malformed values but accept exact balances',()=>{
 for(const value of ['','-1','0','NaN','Infinity','1e3','3.141','8000.01'])assert.ok(paymentError(value,8000),value);
 assert.equal(paymentError('8000',8000),'');
 assert.equal(paymentError('125.50',8000),'');
 assert.ok(paymentError('1',0));
});
test('marks accept zero and the maximum but reject out of range input',()=>{
 for(const value of ['','-1','101','NaN','100.01'])assert.ok(resultError(value),value);
 for(const value of ['0','100','65.5'])assert.equal(resultError(value),'');
});
test('completion requires every lesson, a passed quiz and returned assignment feedback',()=>{
 assert.equal(canComplete(2,2,true,true),true);
 for(const args of [[2,1,true,true],[2,2,false,true],[2,2,true,false],[0,0,true,true],[3,2,true,true]])assert.equal(canComplete(...args),false);
});
