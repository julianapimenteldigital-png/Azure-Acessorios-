const buckets = globalThis.__azureRateBuckets || new Map();
globalThis.__azureRateBuckets = buckets;

class PublicError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function requestHost(req) {
  return String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
}

function requireSameOrigin(req) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  const host = requestHost(req);

  if (fetchSite && fetchSite !== "same-origin") {
    throw new PublicError("Solicitação não autorizada.", 403);
  }

  const source = origin || referer;
  if (!source) {
    if (fetchSite === "same-origin") return;
    throw new PublicError("Origem da solicitação ausente.", 403);
  }

  let sourceHost;
  try {
    sourceHost = new URL(source).host.toLowerCase();
  } catch {
    throw new PublicError("Origem da solicitação inválida.", 403);
  }
  if (!host || sourceHost !== host) throw new PublicError("Solicitação não autorizada.", 403);
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function rateLimit(req, key, limit, windowMs = 60_000) {
  const now = Date.now();
  const bucketKey = `${key}:${clientIp(req)}`;
  const current = buckets.get(bucketKey);
  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > limit) throw new PublicError("Muitas tentativas. Aguarde um minuto e tente novamente.", 429);
  if (buckets.size > 2000) {
    for (const [candidate, value] of buckets) if (value.resetAt <= now) buckets.delete(candidate);
  }
}

function parseBody(req, maxBytes = 20_000) {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!contentType.includes("application/json")) throw new PublicError("Formato de dados não permitido.", 415);
  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  if (Buffer.byteLength(raw, "utf8") > maxBytes) throw new PublicError("Solicitação muito grande.", 413);
  try {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch {
    throw new PublicError("Dados inválidos.");
  }
}

function sendError(res, error, fallback) {
  if (error instanceof PublicError) return res.status(error.status).json({ error: error.message });
  console.error(fallback, error instanceof Error ? error.message : error);
  return res.status(502).json({ error: fallback });
}

function siteUrl() {
  const value = String(process.env.SITE_URL || "").replace(/\/$/, "");
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(value)) {
    throw new PublicError("A URL segura da loja ainda não foi configurada.", 503);
  }
  return value;
}

module.exports = { PublicError, noStore, requireSameOrigin, rateLimit, parseBody, sendError, siteUrl };
