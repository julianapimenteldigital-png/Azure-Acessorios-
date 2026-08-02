const { PublicError, noStore, requireSameOrigin, rateLimit, sendError } = require("../lib/security");

module.exports = async function handler(req, res) {
  noStore(res);
  res.setHeader("Allow", "GET");
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido." });

  try {
    requireSameOrigin(req);
    rateLimit(req, "mp-config", 30);
    const publicKey = String(process.env.MERCADO_PAGO_PUBLIC_KEY || "").trim();
    const productionPublicKey = /^APP_USR-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const testPublicKey = /^TEST-[A-Za-z0-9-]{20,}$/;
    if (!productionPublicKey.test(publicKey) && !testPublicKey.test(publicKey)) {
      throw new PublicError("A Public Key do Mercado Pago está ausente ou foi trocada pelo Access Token. Copie o valor chamado Public Key nas credenciais de produção.", 503);
    }
    return res.status(200).json({ publicKey });
  } catch (error) {
    return sendError(res, error, "Não foi possível preparar o pagamento agora.");
  }
};
