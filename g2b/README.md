# 나라장터 공고 한 건 조회 시험 준비

상태: 연결 코드 초안. 운영 앱에 미연결·미배포. 실제 API 응답 미검증.
기존 Firebase 무료 요금제·로그인·데이터 규칙·index.html은 변경하지 않습니다.

## 사용자가 준비할 것
1. https://www.data.go.kr/data/15129394/openapi.do 에서 활용신청합니다. 용역조회와 첨부파일정보조회 기능을 포함하고 승인 상태를 확인합니다.
2. 실제 용역 공고번호와 차수(예: 000)를 하나 준비합니다. 아래 가상 시험 번호는 실제 공고가 아닙니다.
3. https://dash.cloudflare.com/ 에 가입하고 Workers Free 플랜을 유지합니다. Workers Paid와 별도 유료 상품은 선택하지 않습니다.
4. Worker 이름은 team-calendar-g2b로 생성합니다. 배포 코드는 worker.mjs입니다.
5. Worker 설정의 Variables and Secrets에 DATA_GO_KR_SERVICE_KEY를 Secret 유형으로 등록합니다. 공공데이터포털의 **Decoding 인증키**를 입력합니다. 키를 채팅·GitHub·Firestore에 붙이지 않습니다.
6. FIREBASE_WEB_API_KEY도 등록합니다. 기존 Firebase 설정의 apiKey이며 나라장터 키와 다릅니다. 이 키에 웹사이트 전용 제한이 있다면 서버의 계정확인 요청이 거부될 수 있으므로 실제 시험에서 확인해야 합니다. 기존 키의 제한을 임의로 해제하지 마세요.
7. 일반 변수 ALLOWED_ORIGIN=https://himorisy-beep.github.io, FIREBASE_PROJECT_ID=team-calendar-e30d3를 등록합니다.

## 공고 한 건 시험
운영 화면을 바꾸기 전에 기존 앱에서 로그인한 사용자로 client.mjs의 lookupNotice를 호출합니다.

```js
const result = await lookupNotice({
  endpoint: 'https://실제-worker주소.workers.dev/notice',
  user: firebase.auth().currentUser,
  number: '실제공고번호',
  order: '000'
});
```

이 함수는 조회만 하며 제안을 저장하지 않습니다. 공고번호·차수, 공고명, 수요기관, 입찰마감과 제안서 제출마감의 차이, 첨부파일명·URL을 원문과 대조합니다. 관리자·팀장·일반 멤버의 활성 계정은 조회 가능하고 미로그인·비활성·미등록 계정은 거절합니다. 현재 Firestore 규칙이 본인의 users/{uid} 문서를 읽도록 허용하는지 실제 확인이 필요합니다. 실패해도 앱의 규칙을 자동 수정하지 않습니다.

## 배포 전 검증
- `node --test g2b/test.mjs` : 가상 응답으로 검증.
- 실제 공고 응답 필드와 첨부파일 페이지 수를 확인한 뒤 화면 연결 및 첨부파일 선택 저장을 구현합니다. 현재 client는 원응답 조회와 선택된 텍스트 필드 복원 유틸리티까지이며 **기존 모달·첨부파일 저장에 연결되지 않았습니다**.
- 원문 URL은 http/https만 허용하고 새 탭에는 noopener noreferrer 적용. 이름은 textContent로 출력합니다.
- 이름·마감일 기본 미선택, 팀원 체크 선택·준비 시작일·메모·기존 파일 유지, 중복 URL 제거, 나중의 수동수정 보존을 확인합니다.
- 모바일 320/375/430px, 데스크톱 폭, 조회 취소·오류·시간초과 후 작성값 유지를 확인합니다.
- 공고 결과를 저장하면 기존 제안 권한을 적용합니다. 조회 자격을 제안 수정 권한으로 사용하지 않습니다.
- Firebase 로그인을 검사하므로 서버 인증확인 요청과 Firestore 사용자문서 읽기가 추가됩니다. 기존 무료 한도에 포함되는 사용량도 확인합니다.
- CORS만으로 인증하지 않습니다. 로그인 및 활성 팀원 검사를 수행합니다. 운영 연결 전 사용자별 요청 제한·동일 공고 캐시를 추가하고 무료 Worker CPU 제한에서도 검증합니다. 현재 초안은 전역 요청 제한·캐시 미구현입니다.
- 나라장터 비정상 응답 원문/인증키/로그인 토큰을 오류·로그에 출력하지 않습니다.

## 복구
아직 index.html을 바꾸지 않아 운영 복구가 필요 없습니다. 향후 기능 제거 시 버튼과 호출만 제거하고 기존 제안·첨부파일은 삭제하지 않습니다. 키를 폐기하려면 Worker Secret 삭제 및 공공데이터포털에서 사용 상태를 확인합니다.

## 공식 근거
- https://www.data.go.kr/data/15129394/openapi.do (2026-11-10 개정, 조회기간 최대 7일 안내; 공고번호 조회 지원)
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/platform/limits/
- https://firebase.google.com/docs/reference/rest/auth
