import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorker} from './worker.mjs';
import {applySelected,undoSelected,lookupNotice} from './client.mjs';
const env={ALLOWED_ORIGIN:'https://himorisy-beep.github.io',FIREBASE_PROJECT_ID:'test-project',FIREBASE_WEB_API_KEY:'test-firebase',DATA_GO_KR_SERVICE_KEY:'test-only+/='};
const input={number:'R26BK12345678',order:'000'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
const api=items=>json({response:{header:{resultCode:'00'},body:{totalCount:items.length,items:{item:items}}}});
function fixture({active=true,role='member',attachmentFailure=false,networkFailure=false}={}) {
 const urls=[];
 const worker=createWorker(async(url,options)=>{urls.push(String(url));if(networkFailure)throw Error('secret-internal-url');
 if(String(url).includes('accounts:lookup'))return json({users:[{localId:'uid'}]});
 if(String(url).includes('firestore.googleapis'))return json({fields:{active:{booleanValue:active},role:{stringValue:role},memberId:{stringValue:'m1'}}});
 const u=new URL(url);assert.equal(u.searchParams.get('serviceKey'),env.DATA_GO_KR_SERVICE_KEY);assert.equal(u.searchParams.get('inqryDiv'),'2');
 if(u.pathname.includes('AtchFile'))return attachmentFailure?new Response('unavailable',{status:503}):api([{atchFileNm:'sample.pdf',atchFileUrl:'https://example.com/sample'}]);
 return api([{bidNtceNo:input.number,bidNtceOrd:'000',bidNtceNm:'가상 용역'}]);
 });return {worker,urls};
}
function req(body=input,token=true,origin=env.ALLOWED_ORIGIN){return new Request('https://test.workers.dev/notice',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer mock-token'}:{})},body:JSON.stringify(body)});}
test('one notice plus attachments, common key does not reach output',async()=>{const {worker,urls}=fixture();const r=await worker.fetch(req(),env);assert.equal(r.status,200);const s=await r.text();assert.match(s,/가상 용역/);assert(!s.includes(env.DATA_GO_KR_SERVICE_KEY));assert.equal(urls.length,4);});
test('anonymous request rejected before external request',async()=>{const {worker,urls}=fixture();assert.equal((await worker.fetch(req(input,false),env)).status,401);assert.equal(urls.length,0);});
test('wrong origin rejected before external request',async()=>{const {worker,urls}=fixture();assert.equal((await worker.fetch(req(input,true,'https://evil.example'),env)).status,403);assert.equal(urls.length,0);});
test('inactive and unknown role refused',async()=>{for(const options of [{active:false},{role:'unknown'}])assert.equal((await fixture(options).worker.fetch(req(),env)).status,403);});
test('each active app role may look up without changing proposal permission',async()=>{for(const role of ['admin','team_leader','member'])assert.equal((await fixture({role}).worker.fetch(req(),env)).status,200);});
test('malformed notice rejected without network',async()=>{const {worker,urls}=fixture();assert.equal((await worker.fetch(req({...input,number:'https://evil.example'}),env)).status,400);assert.equal(urls.length,0);});
test('attachment failure retains notice with explicit warning',async()=>{const r=await fixture({attachmentFailure:true}).worker.fetch(req(),env);assert.equal(r.status,200);assert((await r.json()).warning);});
test('external failure does not expose internal detail',async()=>{const r=await fixture({networkFailure:true}).worker.fetch(req(),env);assert.equal(r.status,502);assert(!(await r.text()).includes('secret-internal'));});
test('missing config fails closed',async()=>{assert.equal((await fixture().worker.fetch(req(),{...env,DATA_GO_KR_SERVICE_KEY:''})).status,503);});
test('selected changes and undo preserve manually edited data and team',()=>{const old={name:'내부명',deadline:'2026-11-30',members:['A'],note:'메모'};const a=applySelected(old,{name:'공식명',deadline:'2026-12-01'},['name','deadline']);assert.equal(old.name,'내부명');a.proposal.name='수동 수정';const b=undoSelected(a.proposal,a.undo);assert.equal(b.proposal.name,'수동 수정');assert.equal(b.proposal.deadline,old.deadline);assert.deepEqual(b.proposal.members,old.members);});
test('client passes login token and no shared API key',async()=>{await lookupNotice({endpoint:'https://test.workers.dev/notice',user:{getIdToken:async()=>'token'},...input,fetcher:async(url,opts)=>{assert.equal(opts.headers.Authorization,'Bearer token');assert.deepEqual(JSON.parse(opts.body),input);return json({notice:{}});}});});
