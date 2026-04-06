# [Phase 2] 클라이언트 시그널링 업그레이드 및 Simulcast 구현 계획

Phase 1에서 구축한 Durable Objects 백엔드를 활용하여 클라이언트의 통신 방식을 실시간으로 전환하고, 다자간 회의 시의 대역폭 최적화를 위한 사이멀캐스트를 적용합니다.

## User Review Required

> [!IMPORTANT]
> **WebSocket 전환**: 기존의 HTTP Polling 방식(`SignalingClient.js`)을 완전히 제거하고 WebSocket으로 전환합니다. 연결 끊김 시 자동 재접속(Exponential Backoff) 로직을 포함합니다.

> [!TIP]
> **Simulcast 적용**: `WebRTCManager.js`에서 영상 트랙을 추가할 때 3개의 인코딩 레이어를 설정합니다. 이를 통해 수신측에서는 네트워크 상태에 따라 최적의 해상도를 선택할 수 있게 됩니다.

## Proposed Changes

### [Component] 프론트엔드 시그널링 (Signaling)

#### [MODIFY] [SignalingClient.js](file:///Users/jooyoungkim/Develop/gate1253/brand/public/js/sfu/SignalingClient.js)
- `WebSocket` 클래스 도입 및 `ws://` 경로 연결
- `sendSignal` 함수를 `ws.send()` 호출로 변경
- 서버로부터 오는 `message` 이벤트를 리스닝하여 `onSignal` 콜백 실행

### [Component] WebRTC 미디어 엔진

#### [MODIFY] [WebRTCManager.js](file:///Users/jooyoungkim/Develop/gate1253/brand/public/js/sfu/WebRTCManager.js)
- `addTransceiver` 설정 시 `sendEncodings` 옵션 추가:
  - rid: 'h' (high), 'm' (medium), 'l' (low)
- `onTrack` 이벤트 핸들러에서 리포트(`getStats`) 분석을 통한 동적 대역폭 대응(ABR) 기초 마련

## Open Questions

- **Simulcast 레이어 상세 설정**: High(1.2Mbps), Med(300kbps), Low(100kbps) 정도로 설정할 계획입니다. 특정 운영 환경에 맞춰 조정이 필요할까요?
- **하위 호환성**: 신규 WebSocket 경로(`/ws/join`)만 사용하도록 전환할 예정이나, 오류 시 폴백(Fallback)으로 기존 폴링 방식을 유지할 필요가 있을까요? (동작 신뢰성을 위해 추천하지 않음)

## Verification Plan

### Automated Tests
- 브라우저 콘솔에서 WebSocket 연결 상태(`.readyState === 1`) 확인
- 가상 대역폭 제한 도구(Network Throttling)를 사용하여 저해상도 레이어 수신 여부 확인

### Manual Verification
- 3인 이상의 다수 접속 시 지연 시간(Latency)이 1초 이하로 유지되는지 확인
- 한 참가자의 카메라를 껐다 켰을 때 즉각적으로 다른 참여자에게 반영되는지 확인
