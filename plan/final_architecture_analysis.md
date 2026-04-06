# 구글 미트 수준 다자간 SFU 아키텍처 공통 분석 보고서 (Antigravity & Claude)

본 보고서는 Gemini(Antigravity)와 Claude의 협업 분석을 통해 작성된 최종 아키텍처 가이드라인입니다.

## 1. 종합 진단 결과
현재 `sfuTemplate.js` 기반의 시스템은 대규모(3인 이상) 실시간 소통에 부적합한 "임시 메시 기반" 구조에 가깝습니다.

### 🚫 주요 병목 구간
1. **시그널링 레이턴시**: KV Polling 방식은 참여자 간 '제안-응답(Offer-Answer)' 과정에서 수 초의 지연을 발생시켜 오디오/비디오 동기화를 방해합니다.
2. **비트레이트 폭발**: 전송 해상도 고정으로 인해 수신측 네트워크 대역폭이 5인 접속 시 4배 이상의 부하를 견뎌야 합니다. 
3. **리소스 관리 부재**: 화자(Active Speaker) 인지 로직이 없어 불필요한 고해상도 연산을 모든 참여자에게 강제합니다.

---

## 2. 권장 기술 스택 및 구조 (Google Meet 레벨)

### 🛰️ 실시간 시그널링: Durable Objects 전환
* **WebSocket 인터페이스**: KV 대신 Durable Objects를 통해 직접 WebSocket 연결을 유지합니다.
* **낮은 지연시간**: 방 내부의 모든 상태 공유가 메모리 레벨에서 이루어져 지연시간이 50ms 미만으로 단축됩니다.

### 📽️ 사이멀캐스트(Simulcast) 도입
* **다중 레이어 송신**: 클라이언트가 `RTCRtpTransceiver`를 사용하여 High(720p), Medium(360p), Low(180p)를 동시 송신합니다.
* **선별적 포워딩**: SFU(Cloudflare Calls)가 수신자의 화면 크기와 네트워크 상황에 맞춰 최적의 해상도만 전달합니다.

### 🎤 화자 중심 관리 (VAD-driven UI)
* **음성 파형 감지**: Web Audio API로 로컬 음량을 체크하여 화자 상태를 시그널링 서버에 공유합니다.
* **동적 구독 제어**: 주 화자는 영상 트랙을 수신하고, 보조 참여자는 영상 수신을 저해상도로 낮추거나 일시 정지하여 수신측 부하를 80% 이상 절감합니다.

---

## 3. 구현 로드맵

1. **Phase 1**: `webrtc-worker.js`를 Durable Objects 기반 WebSocket 서버로 전환 (시그널링 개편).
2. **Phase 2**: `WebRTCManager.js`에 Simulcast 송신 설정 및 동적 구독 로직 구현.
3. **Phase 3**: `MediaManager.js`에 VAD(화자 감지) 로직 추가 및 UI 연동.
4. **Phase 4**: 네트워크 패킷 손실 감지 시 해상도를 강제 조정하는 ABR(Adaptive Bitrate) 추가.
