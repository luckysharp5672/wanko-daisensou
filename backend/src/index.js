// わんこ大戦争 バックエンドAPI（Cloudflare Workers + D1）
// - セーブデータの保存・同期（プレイヤーは匿名UUIDで識別）
// - ステージ×難易度ごとのクリアタイムランキング

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAGE_ID_RE = /^[a-z0-9-]{1,20}$/;
const DIFFICULTIES = new Set(['normal', 'hard', 'extreme']);
const MAX_DATA_BYTES = 200_000;
const MAX_NAME_LEN = 20;
const RANKING_LIMIT_MAX = 50;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function clampName(name) {
  if (typeof name !== 'string') return '名無し';
  const trimmed = name.trim().slice(0, MAX_NAME_LEN);
  return trimmed || '名無し';
}

async function handleGetSave(env, playerId) {
  if (!UUID_RE.test(playerId)) return json({ error: 'invalid playerId' }, 400);
  const row = await env.DB.prepare(
    'SELECT name, data, updated_at FROM saves WHERE player_id = ?'
  )
    .bind(playerId)
    .first();
  if (!row) return json({ error: 'not found' }, 404);
  return json({ name: row.name, data: JSON.parse(row.data), updatedAt: row.updated_at });
}

async function handlePutSave(request, env, playerId) {
  if (!UUID_RE.test(playerId)) return json({ error: 'invalid playerId' }, 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const { name, data, updatedAt } = body || {};
  if (typeof data !== 'object' || data === null) return json({ error: 'data is required' }, 400);
  if (!Number.isFinite(updatedAt)) return json({ error: 'updatedAt is required' }, 400);

  const serialized = JSON.stringify(data);
  if (serialized.length > MAX_DATA_BYTES) return json({ error: 'data too large' }, 413);

  // 古い端末が新しいデータを上書きしないよう、サーバー側の方が新しければ拒否する
  const existing = await env.DB.prepare(
    'SELECT updated_at FROM saves WHERE player_id = ?'
  )
    .bind(playerId)
    .first();
  if (existing && existing.updated_at > updatedAt) {
    return json({ error: 'conflict: server data is newer', updatedAt: existing.updated_at }, 409);
  }

  await env.DB.prepare(
    `INSERT INTO saves (player_id, name, data, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(player_id) DO UPDATE SET name = excluded.name, data = excluded.data, updated_at = excluded.updated_at`
  )
    .bind(playerId, clampName(name), serialized, updatedAt)
    .run();

  return json({ ok: true });
}

async function handlePostRanking(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const { playerId, playerName, stageId, difficulty, clearTimeMs } = body || {};
  if (!UUID_RE.test(playerId)) return json({ error: 'invalid playerId' }, 400);
  if (!STAGE_ID_RE.test(stageId || '')) return json({ error: 'invalid stageId' }, 400);
  if (!DIFFICULTIES.has(difficulty)) return json({ error: 'invalid difficulty' }, 400);
  if (!Number.isFinite(clearTimeMs) || clearTimeMs <= 0 || clearTimeMs > 24 * 60 * 60 * 1000) {
    return json({ error: 'invalid clearTimeMs' }, 400);
  }

  // 自己ベストのみ保持（既存記録より遅い場合は何もしない）
  const existing = await env.DB.prepare(
    'SELECT clear_time_ms FROM rankings WHERE player_id = ? AND stage_id = ? AND difficulty = ?'
  )
    .bind(playerId, stageId, difficulty)
    .first();
  if (existing && existing.clear_time_ms <= clearTimeMs) {
    return json({ ok: true, updated: false });
  }

  await env.DB.prepare(
    `INSERT INTO rankings (player_id, stage_id, difficulty, player_name, clear_time_ms, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(player_id, stage_id, difficulty) DO UPDATE SET
       player_name = excluded.player_name,
       clear_time_ms = excluded.clear_time_ms,
       updated_at = excluded.updated_at`
  )
    .bind(playerId, stageId, difficulty, clampName(playerName), Math.round(clearTimeMs), Date.now())
    .run();

  return json({ ok: true, updated: true });
}

async function handleGetRanking(url, env, stageId) {
  if (!STAGE_ID_RE.test(stageId)) return json({ error: 'invalid stageId' }, 400);
  const difficulty = url.searchParams.get('difficulty') || 'normal';
  if (!DIFFICULTIES.has(difficulty)) return json({ error: 'invalid difficulty' }, 400);
  const limit = Math.min(RANKING_LIMIT_MAX, Math.max(1, Number(url.searchParams.get('limit')) || 20));

  const { results } = await env.DB.prepare(
    `SELECT player_name, clear_time_ms, updated_at FROM rankings
     WHERE stage_id = ? AND difficulty = ?
     ORDER BY clear_time_ms ASC
     LIMIT ?`
  )
    .bind(stageId, difficulty, limit)
    .all();

  return json({
    stageId,
    difficulty,
    entries: results.map((r) => ({
      playerName: r.player_name,
      clearTimeMs: r.clear_time_ms,
      updatedAt: r.updated_at,
    })),
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean); // ['api', 'save', ':id'] など

    try {
      if (parts[0] === 'api' && parts[1] === 'save' && parts[2]) {
        if (request.method === 'GET') return await handleGetSave(env, parts[2]);
        if (request.method === 'PUT') return await handlePutSave(request, env, parts[2]);
      }

      if (parts[0] === 'api' && parts[1] === 'ranking' && !parts[2] && request.method === 'POST') {
        return await handlePostRanking(request, env);
      }

      if (parts[0] === 'api' && parts[1] === 'ranking' && parts[2] && request.method === 'GET') {
        return await handleGetRanking(url, env, parts[2]);
      }
    } catch (err) {
      return json({ error: 'internal error', message: String(err) }, 500);
    }

    return json({ error: 'not found' }, 404);
  },
};
