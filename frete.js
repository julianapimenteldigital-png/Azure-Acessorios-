const { validateCart } = require("../lib/catalog");
const { quoteShipping } = require("../lib/melhor-envio");
const { PublicError, noStore, requireSameOrigin, rateLimit, parseBody, sendError } = require("../lib/security");

module.exports = async function handler(req, res) {
  noStore(res);
  res.setHeader("Allow", "POST");
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
  try {
    requireSameOrigin(req);
    rateLimit(req, "frete", 20);
    const body = parseBody(req);
    let lines;
    try { lines = validateCart(body.cart); } catch (error) { throw new PublicError(error.message); }
    if (String(body.cep || "").replace(/\D/g, "").length !== 8) throw new PublicError("Informe um CEP válido com 8 números.");
    const quotes = await quoteShipping(body.cep, lines);
    if (!quotes.length) throw new PublicError("Não encontramos PAC ou SEDEX para esse CEP.");
    return res.status(200).json({ quotes });
  } catch (error) {
    return sendError(res, error, "Não foi possível calcular o frete agora.");
  }
};
