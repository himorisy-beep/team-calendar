// Call with the existing firebase.auth().currentUser. No key is sent from the app.
export async function lookupNotice({endpoint,user,number,order='000',fetcher=fetch}) {
  if(!user) throw new Error('먼저 로그인해주세요.');
  const url=new URL(endpoint);
  if(url.protocol!=='https:' || !url.hostname.endsWith('.workers.dev') || url.pathname!=='/notice') throw new Error('중계 서버의 HTTPS /notice 주소를 확인해주세요.');
  const token=await user.getIdToken();
  const response=await fetcher(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({number:number.trim(),order:order.trim()}),signal:AbortSignal.timeout(30000),credentials:'omit',redirect:'error'});
  const data=await response.json();
  if(!response.ok) throw new Error(data.error||'공고 조회에 실패했습니다.');
  return data;
}
// No automatic Firestore writes. Display and select fields before saving.
export function applySelected(proposal,incoming,selected) {
  const next=structuredClone(proposal),changes=[];
  for(const key of ['name','demandOrg','deadline']) {
    if(selected.includes(key) && typeof incoming[key]==='string' && incoming[key]!==next[key]) {
      changes.push({key,existed:Object.hasOwn(next,key),before:next[key],after:incoming[key]});next[key]=incoming[key];
    }
  }
  return {proposal:next,undo:changes};
}
export function undoSelected(proposal,changes) {
  const next=structuredClone(proposal),preserved=[];
  for(const c of changes) {
    if(next[c.key]!==c.after) {preserved.push(c.key);continue;}
    if(c.existed) next[c.key]=c.before; else delete next[c.key];
  }
  return {proposal:next,preserved};
}
