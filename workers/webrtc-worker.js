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
        const pathname = url.pathname;

        // Cloudflare Calls API Proxy
        if (pathname.startsWith('/calls')) {
            const appId = env.CF_CALLS_APP_ID;
            const appToken = env.CF_CALLS_APP_TOKEN;

            if (!appId || !appToken) {
                return new Response(JSON.stringify({ error: 'Cloudflare Calls credentials not configured' }), {
                    status: 500,
                    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders())
                });
            }

            // 1. Create Session
            if (request.method === 'POST' && pathname === '/calls/session') {
                const res = await fetch(`https://rtc.live.cloudflare.com/v1/apps/${appId}/sessions/new`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${appToken}`,
                    }
                });
                const data = await res.json();
                return new Response(JSON.stringify(data), {
                    status: res.status,
                    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders())
                });
            }

            // 2. Renegotiate (Publish/Subscribe)
            // Path: /calls/sessions/:sessionId/renegotiate
            const renegMatch = pathname.match(/\/calls\/sessions\/([^\/]+)\/renegotiate/);
            if (request.method === 'POST' && renegMatch) {
                const sessionId = renegMatch[1];
                const body = await request.json(); // { sdp, tracks }

                // Exchange SDP with Cloudflare
                const res = await fetch(`https://rtc.live.cloudflare.com/v1/apps/${appId}/sessions/${sessionId}/renegotiate`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${appToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionDescription: {
                            type: body.type || 'offer',
                            sdp: body.sdp
                        },
                        tracks: body.tracks
                    })
                });

                const data = await res.json();
                // Cloudflare returns { sessionDescription: { type: 'answer', sdp: ... } }
                // We return simplified { sdp: ... }
                let responseData = data;
                if (data.sessionDescription) {
                    responseData = { sdp: data.sessionDescription.sdp };
                }

                return new Response(JSON.stringify(responseData), {
                    status: res.status,
                    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders())
                });
            }

            return new Response('Not found', { status: 404, headers: corsHeaders() });
        }

        // POST: 메시지 저장 (Signaling)
        if (request.method === 'POST') {
            try {
                const data = await request.json();
                const room = data.room;

                if (!room) {
                    return new Response('Missing room', { status: 400, headers: corsHeaders() });
                }

                // join 신호일 경우 접속 인원 체크 (최대 10명으로 완화)
                if (data.type === 'join') {
                    const list = await env.WEBRTC_KV.list({ prefix: `${room}:` });
                    const messages = await Promise.all(list.keys.map(key => env.WEBRTC_KV.get(key.name, { type: 'json' })));
                    const clientIds = new Set();
                    messages.forEach(msg => { if (msg && msg.clientId) clientIds.add(msg.clientId); });

                    if (clientIds.size >= 10 && !clientIds.has(data.clientId)) {
                        return new Response(JSON.stringify({ error: 'Room is full' }), { status: 403, headers: corsHeaders() });
                    }
                }

                // 개별 메시지를 별도의 키로 저장하여 경쟁 상태(Race Condition) 방지
                // 키 형식: room:timestamp:random
                const timestamp = Date.now();
                const random = Math.random().toString(36).substring(2, 10);
                const key = `${room}:${timestamp}:${random}`;

                data.timestamp = timestamp;
                await env.WEBRTC_KV.put(key, JSON.stringify(data), { expirationTtl: 600 });

                return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders() });
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

            // 해당 방의 모든 메시지 키 조회
            const list = await env.WEBRTC_KV.list({ prefix: `${room}:` });

            // 병렬로 메시지 내용 가져오기
            const messages = await Promise.all(list.keys.map(async (key) => {
                return await env.WEBRTC_KV.get(key.name, { type: 'json' });
            }));

            // null 값 제거 및 타임스탬프 정렬
            const validMessages = messages.filter(msg => msg !== null).sort((a, b) => a.timestamp - b.timestamp);

            return new Response(JSON.stringify(validMessages), {
                status: 200,
                headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders())
            });
        }

        return new Response('Not found', { status: 404, headers: corsHeaders() });
    }
};
