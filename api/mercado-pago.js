const crypto = require("crypto");
const { validateCart } = require("../lib/catalog");
const { quoteShipping } = require("../lib/melhor-envio");
const { PublicError, noStore, requireSameOrigin, rateLimit, parseBody, sendError, siteUrl } = require("../lib/security");

module.exports = async function handler(req, res) {
  noStore(res);
  res.setHeader("Allow", "POST");
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
  try {
    requireSameOrigin(req);
    rateLimit(req, "pagamento", 8);
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) throw new PublicError("O pagamento ainda não foi ativado.", 503);
    const body = parseBody(req);
    let lines;
    try { lines = validateCart(body.cart); } catch (error) { throw new PublicError(error.message); }
    if (String(body.cep || "").replace(/\D/g, "").length !== 8) throw new PublicError("Informe um CEP válido com 8 números.");
    const quotes = await quoteShipping(body.cep, lines);
    const shipping = quotes.find((quote) => quote.id === Number(body.shippingId));
    if (!shipping) throw new PublicError("Escolha uma opção de entrega válida.");

    const storeUrl = siteUrl();
    const reference = `AZURE-${crypto.randomUUID()}`;
    const preference = {
      items: lines.map((line) => ({
        id: String(line.product.id),
        title: line.product.name,
        description: `Cor: ${line.color}`,
        currency_id: "BRL",
        quantity: line.quantity,
        unit_price: line.product.price
      })),
      shipments: { cost: shipping.price, mode: "not_specified" },
      external_reference: reference,
      metadata: { cep: String(body.cep).replace(/\D/g, ""), entrega: `${shipping.company} ${shipping.name}` },
      back_urls: {
        success: `${storeUrl}/?retorno=mercado-pago`,
        pending: `${storeUrl}/?retorno=mercado-pago`,
        failure: `${storeUrl}/?retorno=mercado-pago`
      },
      auto_return: "approved",
      statement_descriptor: "AZURE ACESSORIOS"
    };

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": reference
      },
      body: JSON.stringify(preference),
      signal: AbortSignal.timeout(12_000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error("Mercado Pago recusou a criação da preferência.");
    const sandbox = process.env.MERCADO_PAGO_ENV === "sandbox";
    const checkoutUrl = sandbox ? data?.sandbox_init_point : data?.init_point;
    let checkoutHost;
    try { checkoutHost = new URL(checkoutUrl).hostname; } catch { checkoutHost = ""; }
    if (!/(^|\.)mercadopago\.com(\.br)?$/i.test(checkoutHost)) throw new Error("URL de pagamento inválida.");
    return res.status(200).json({ url: checkoutUrl });
  } catch (error) {
    return sendError(res, error, "Não foi possível iniciar o pagamento agora.");
  }
};
