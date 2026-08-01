const { PublicError, noStore, requireSameOrigin, rateLimit, parseBody, sendError } = require("../lib/security");

module.exports = async function handler(req, res) {
  noStore(res);
  res.setHeader("Allow", "POST");
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  try {
    requireSameOrigin(req);
    rateLimit(req, "status-pagamento", 20);
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) throw new PublicError("A confirmação do pagamento ainda não foi ativada.", 503);
    const { paymentId } = parseBody(req, 2_000);
    const id = String(paymentId || "");
    if (!/^\d{1,30}$/.test(id)) throw new PublicError("Identificador de pagamento inválido.");

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000)
    });
    const payment = await response.json().catch(() => null);
    if (!response.ok) throw new Error("Mercado Pago não confirmou o pagamento.");
    if (!String(payment?.external_reference || "").startsWith("AZURE-")) {
      throw new PublicError("Este pagamento não pertence à Azure Acessórios.", 403);
    }

    const allowed = new Set(["approved", "pending", "in_process", "rejected", "cancelled", "refunded", "charged_back"]);
    const status = allowed.has(payment.status) ? payment.status : "unknown";
    return res.status(200).json({ status });
  } catch (error) {
    return sendError(res, error, "Não foi possível confirmar o pagamento agora.");
  }
};
