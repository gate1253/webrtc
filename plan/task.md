# [Phase 1] Durable Objects 기반 실시간 시그널링 구현 (작업 추적)

- [x] wrangler.toml 에 Durable Objects 및 Migrations 설정 추가
- [x] SignalingRoom Durable Object 클래스 구현 (workers/signaling-do.js)
- [x] webrtc-worker.js 수정: WebSocket 요청(/ws/join)을 Durable Object로 라우팅
- [x] 기존 KV 폴링 방식과의 하위 호환성 유지 확인

---

## Claude에게 전달할 지시사항 (Prompt)
> "webrtc 프로젝트의 시그널링 시스템을 Durable Objects 기반의 WebSockets 방식으로 업그레이드해줘. 
> 1. wrangler.toml 에 'SignalingRoom'이라는 Durable Object를 추가하고 마이그레이션 설정을 넣어. 
> 2. `workers/signaling-do.js` 파일을 새로 만들어 Durable Object 로직(WebSocket onMessage, onClose, 참여자 관리)을 구현해.
> 3. `workers/webrtc-worker.js` 에서 `/ws/join` 경로로 오는 요청을 이 Durable Object로 연결해. 
> 4. 배포 시 문제가 없도록 기존 KV 폴링 로직은 그대로 두고, 신규 경로로만 동작하게 구현해줘. 
> 5. 분석된 아키텍처 가이드는 `webrtc/plan/final_architecture_analysis.md`를 참고해."
