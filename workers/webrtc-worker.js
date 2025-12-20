// d:\workspace\gate1253\webrtc\workers\webrtc-worker.js

// CORS 유틸리티 함수
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
    };
}

export default {
    async fetch(request, env) {
        // OPTIONS preflight 처리
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders() });
        }

        const url = new URL(request.url);
        
        // POST: 메시지 저장 (Signaling)
        if (request.method === 'POST') {
            try {
                const data = await request.json();
                const room = data.room;
                
                if (!room) {
                    return new Response('Missing room', { status: 400, headers: corsHeaders() });
                }

                // 기존 메시지 가져오기 (없으면 빈 배열)
                let messages = await env.WEBRTC_KV.get(room, { type: 'json' });
                if (!messages) messages = [];

                // 메시지에 서버 수신 타임스탬프 추가
                data.timestamp = Date.now();
                messages.push(data);

                // KV에 저장 (TTL 10분 설정으로 오래된 방 자동 정리)
                await env.WEBRTC_KV.put(room, JSON.stringify(messages), { expirationTtl: 600 });

                return new Response(JSON.stringify({ success: true, messages }), { status: 200, headers: corsHeaders() });
            } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders() });
            }
        }

        // GET: 메시지 조회 (Polling)
        if (request.method === 'GET') {
            const room = url.searchParams.get('room');
            if (!room) {
                return new Response('Missing room param', { status: 400, headers: corsHeaders() });
            }

            // 해당 방의 모든 메시지 반환
            const messages = await env.WEBRTC_KV.get(room, { type: 'json' });
            return new Response(JSON.stringify(messages || []), { 
                status: 200, 
                headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders()) 
            });
        }

        return new Response('Not found', { status: 404, headers: corsHeaders() });
    }
};
