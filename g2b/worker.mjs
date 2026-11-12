const BASE = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService02/';
class Failure extends Error { constructor(status, message) { super(message); this.status=status; } }
export function rows(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if ('item' in value) return rows(value.item);
  return [value];
}
export function createWorker(fetcher=fetch) {
  async function request(url, options={}) {
    return fetcher(url, {...options, redirect:'error', signal:AbortSignal.timeout(12000)});
  }
  async function authorize(req, env) {
    const token = req.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) throw new Failure(401,'기존 앱에 먼저 로그인해주세요.');
    const response=await request('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(env.FIREBASE_WEB_API_KEY), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});
    if(!response.ok) throw new Failure(401,'로그인을 다시 확인해주세요.');
    const account=(await response.json()).users?.[0];
    if(!account?.localId || account.disabled) throw new Failure(401,'사용할 수 없는 계정입니다.');
    const userResponse=await request('https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(env.FIREBASE_PROJECT_ID)+'/databases/(default)/documents/users/'+encodeURIComponent(account.localId), {headers:{Authorization:'Bearer '+token}});
    if(!userResponse.ok) throw new Failure(403,'팀원 권한을 확인할 수 없습니다.');
    const f=(await userResponse.json()).fields;
    if(f?.active?.booleanValue!==true || !['admin','team_leader','member'].includes(f?.role?.stringValue) || !f?.memberId?.stringValue) throw new Failure(403,'활성 팀원만 조회할 수 있습니다.');
  }
  async function api(operation, input, env) {
    const url=new URL(BASE+operation);
    url.search=new URLSearchParams({serviceKey:env.DATA_GO_KR_SERVICE_KEY,numOfRows:'100',pageNo:'1',type:'json',inqryDiv:'2',bidNtceNo:input.number,bidNtceOrd:input.order,...(operation.includes('AtchFile')?{bsnsDivCd:'5'}:{})});
    const response=await request(url);
    if(!response.ok) throw new Failure(502,'나라장터 응답 오류입니다. 잠시 후 다시 시도해주세요.');
    let data;try { data=await response.json(); } catch { throw new Failure(502,'나라장터가 JSON 응답을 반환하지 않았습니다. 인증키·승인 상태를 확인해주세요.'); }
    const result=data.response;
    if(!result || !['00','0'].includes(String(result.header?.resultCode))) throw new Failure(502,'나라장터 조회가 거절되었습니다. 인증키·승인 상태·호출 한도를 확인해주세요.');
    if(Number(result.body?.totalCount||0)>100) throw new Failure(502,'응답이 100건을 넘었습니다. 공고번호와 차수를 확인해주세요.');
    return rows(result.body?.items);
  }
  return {async fetch(req,env) {
    const origin=req.headers.get('Origin');
    const allowed=origin===env.ALLOWED_ORIGIN;
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',...(allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})};
    const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
    try {
      if(!allowed) throw new Failure(403,'허용되지 않은 앱 주소입니다.');
      if(new URL(req.url).pathname!=='/notice') throw new Failure(404,'잘못된 경로입니다.');
      if(req.method==='OPTIONS') return new Response(null,{status:204,headers});
      if(req.method!=='POST') throw new Failure(405,'POST 요청만 지원합니다.');
      for(const k of ['DATA_GO_KR_SERVICE_KEY','FIREBASE_WEB_API_KEY','FIREBASE_PROJECT_ID','ALLOWED_ORIGIN']) if(!env[k]) throw new Failure(503,'중계 서버 설정이 완료되지 않았습니다.');
      if(!req.headers.get('Content-Type')?.startsWith('application/json')) throw new Failure(415,'JSON 요청이 필요합니다.');
      const text=await req.text(); if(text.length>1024) throw new Failure(413,'요청이 너무 큽니다.');
      let input;try {input=JSON.parse(text);} catch {throw new Failure(400,'잘못된 요청입니다.');}
      if(!input || typeof input!=='object' || !/^(?:R\d{2}BK\d{8}|\d{11})$/.test(input.number) || !/^\d{3}$/.test(input.order)) throw new Failure(400,'공고번호와 3자리 차수를 확인해주세요.');
      await authorize(req,env);
      const notices=await api('getBidPblancListInfoServc02',input,env);
      const notice=notices.find(n=>n.bidNtceNo===input.number && String(n.bidNtceOrd).padStart(3,'0')===input.order);
      if(!notice) throw new Failure(404,'해당 용역 공고를 찾지 못했습니다. 공고번호·차수·업무구분을 확인해주세요.');
      let attachments=[],warning=null;
      try {attachments=await api('getBidPblancListInfoAtchFileInfo02',input,env);} catch {warning='공고는 조회했지만 첨부파일 조회는 실패했습니다. 원문에서 확인해주세요.';}
      return reply(200,{notice,attachments,warning,fetchedAt:new Date().toISOString()});
    } catch(e) {return reply(e.status||502,{error:e.status?e.message:'외부 서비스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.'});}
  }};
}
export default createWorker();
