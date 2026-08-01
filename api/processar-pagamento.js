const crypto = require("crypto");
const { validateCart, totals } = require("../lib/catalog");
const { quoteShipping } = require("../lib/melhor-envio");
const { PublicError, noStore, requireSameOrigin, rateLimit, parseBody, sendError } = require("../lib/security");

const clean = (value, max = 120) => String(value || "").trim().slice(0, max);

module.exports = async function handler(req, res) {
  noStore(res);
  res.setHeader("Allow", "POST");
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  try {
    requireSameOrigin(req);
    rateLimit(req, "processar-pagamento", 6);
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) throw new PublicError("O pagamento ainda não foi ativado.", 503);

    const body = parseBody(req, 30_000);
    let lines;
    try { lines = validateCart(body.cart); } catch (error) { throw new PublicError(error.message); }

    const cep = clean(body.cep, 16).replace(/\D/g, "");
    if (cep.length !== 8) throw new PublicError("Informe um CEP válido com 8 números.");
    const quotes = await quoteShipping(cep, lines);
    const shipping = quotes.find((quote) => quote.id === Number(body.shippingId));
    if (!shipping) throw new PublicError("Escolha uma opção de entrega válida.");

    const payment = body.payment && typeof body.payment === "object" ? body.payment : {};
    const paymentMethodId = clean(payment.payment_method_id, 40).toLowerCase();
    const isPix = paymentMethodId === "pix";
    if (!isPix && !/^[a-z0-9_-]{2,40}$/.test(paymentMethodId)) {
      throw new PublicError("Meio de pagamento inválido.");
    }

    const payer = payment.payer && typeof payment.payer === "object" ? payment.payer : {};
    const email = clean(payer.email, 160).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PublicError("Informe um e-mail válido.");

    const { productsTotal } = totals(lines);
    const productsCents = Math.round(productsTotal * 100);
    const discountedProducts = Math.round(productsCents * 0.95) / 100;
    const shippingCents = Math.round(shipping.price * 100);
    const transactionAmount = ((isPix ? Math.round(productsCents * 0.95) : productsCents) + shippingCents) / 100;
    const reference = `AZURE-${crypto.randomUUID()}`;
    const identification = payer.identification && typeof payer.identification === "object" ? payer.identification : null;

    const requestBody = {
      transaction_amount: transactionAmount,
      description: "Pedido Azure Acessórios",
      payment_method_id: paymentMethodId,
      external_reference: reference,
      statement_descriptor: "AZURE ACESSORIOS",
      metadata: {
        cep,
        entrega: `${shipping.company} ${shipping.name}`,
        desconto_pix: isPix ? "5% nos produtos" : "não aplicado"
      },
      payer: {
        email,
        ...(identification ? {
          identification: {
            type: clean(identification.type, 10).toUpperCase(),
            number: clean(identification.number, 24).replace(/\D/g, "")
          }
        } : {})
      },
      additional_info: {
        items: lines.map((line) => ({
          id: String(line.product.id),
          title: line.product.name,
          description: `Cor: ${line.color}`,
          category_id: "accessories",
          quantity: line.quantity,
          unit_price: line.product.price
        })),
        shipments: {
          receiver_address: { zip_code: cep }
        }
      }
    };

    if (!isPix) {
      const token = clean(payment.token, 300);
      const installments = Number(payment.installments);
      if (!token || !Number.isInteger(installments) || installments < 1 || installments > 24) {
        throw new PublicError("Dados do cartão incompletos ou inválidos.");
      }
      requestBody.token = token;
      requestBody.installments = installments;
      const issuerId = clean(payment.issuer_id, 30);
      if (issuerId) requestBody.issuer_id = issuerId;
    }

    const idempotencyKey = crypto.randomUUID();
    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15_000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.id) {
      console.error("Mercado Pago recusou o pagamento", response.status, data?.message || data?.cause?.[0]?.description || "sem detalhes");
      throw new PublicError("O Mercado Pago não conseguiu processar esse pagamento. Confira os dados e tente novamente.", 422);
    }

    return res.status(200).json({
      paymentId: String(data.id),
      status: clean(data.status, 30),
      amount: transactionAmount,
      pixDiscount: isPix ? (productsCents - Math.round(productsCents * 0.95)) / 100 : 0
    });
  } catch (error) {
    return sendError(res, error, "Não foi possível processar o pagamento agora.");
  }
};
