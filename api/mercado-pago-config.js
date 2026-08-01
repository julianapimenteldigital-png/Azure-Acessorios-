const { PublicError, noStore, requireSameOrigin, rateLimit, sendError } = require("../lib/security");

module.exports = async function handler(req, res) {
  noStore(res);
  res.setHeader("Allow", "GET");
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido." });

  try {
    requireSameOrigin(req);
    rateLimit(req, "mp-config", 30);
    const publicKey = String(process.env.MERCADO_PAGO_PUBLIC_KEY || "").trim();
    if (!/^APP_USR-[A-Za-z0-9-]{20,}$/.test(publicKey) && !/^TEST-[A-Za-z0-9-]{20,}$/.test(publicKey)) {
      throw new PublicError("A chave pública do Mercado Pago ainda não foi configurada.", 503);
    }
    return res.status(200).json({ publicKey });
  } catch (error) {
    return sendError(res, error, "Não foi possível preparar o pagamento agora.");
  }
};
