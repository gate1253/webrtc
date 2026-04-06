export class SignalingRoom {
  constructor(state, env) {
    this.state = state;
    // 세션별로 연결된 소켓들을 관리합니다.
    this.sessions = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);

    // WebSocket 업그레이드 요청 처리
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const { 0: client, 1: server } = new WebSocketPair();

    await this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleSession(ws) {
    ws.accept();

    // 초기 세션 정보 설정
    const sessionId = crypto.randomUUID();
    const session = { ws, id: sessionId, room: null, clientId: null };
    this.sessions.set(sessionId, session);

    ws.addEventListener("message", async (msg) => {
      try {
        const data = JSON.parse(msg.data);

        // 최초 'join' 메시지 처리
        if (data.type === "join") {
          session.room = data.room;
          session.clientId = data.clientId;
          console.log(`[DO] Client ${data.clientId} joined room ${data.room}`);
          
          // 기존 참여자들에게 알림 (필요 시)
          this.broadcast(session, {
            type: "user_joined",
            clientId: data.clientId,
            timestamp: Date.now()
          });
          return;
        }

        // 일반 시그널링 메시지(offer, answer, candidate) 브로드캐스트
        if (session.room) {
          this.broadcast(session, data);
        }
      } catch (err) {
        console.error("[DO] Message error:", err);
      }
    });

    ws.addEventListener("close", () => {
      console.log(`[DO] Session ${sessionId} closed`);
      if (session.room && session.clientId) {
        this.broadcast(session, {
          type: "leave",
          clientId: session.clientId,
          timestamp: Date.now()
        });
      }
      this.sessions.delete(sessionId);
    });

    ws.addEventListener("error", (err) => {
      console.error("[DO] WebSocket error:", err);
      this.sessions.delete(sessionId);
    });
  }

  // 자기 자신을 제외한 같은 방의 모든 참여자에게 메시지 전송
  broadcast(sender, data) {
    const message = JSON.stringify(data);
    for (const [id, session] of this.sessions) {
      if (id !== sender.id && session.room === sender.room) {
        try {
          session.ws.send(message);
        } catch (err) {
          console.error(`[DO] Broadcast failed to ${id}:`, err);
          this.sessions.delete(id);
        }
      }
    }
  }
}
