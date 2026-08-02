const { totals } = require("./catalog");

const ORIGIN_POSTAL_CODE = "74663520";
const PACKAGE = { width: 15, height: 7, length: 15 };

async function quoteShipping(destinationPostalCode, lines) {
  const token = process.env.MELHOR_ENVIO_TOKEN;
  if (!token) throw new Error("A integração de frete ainda não foi ativada.");
  const userAgent = process.env.MELHOR_ENVIO_USER_AGENT;
  if (!userAgent) throw new Error("O contato da integração de frete ainda não foi configurado.");

  const postalCode = String(destinationPostalCode || "").replace(/\D/g, "");
  if (postalCode.length !== 8) throw new Error("Informe um CEP válido com 8 números.");

  const { productsTotal, weightKg } = totals(lines);
  const sandbox = process.env.MELHOR_ENVIO_ENV === "sandbox";
  const baseUrl = sandbox ? "https://sandbox.melhorenvio.com.br" : "https://melhorenvio.com.br";
  const response = await fetch(`${baseUrl}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": userAgent
    },
    body: JSON.stringify({
      from: { postal_code: ORIGIN_POSTAL_CODE },
      to: { postal_code: postalCode },
      services: "1,2",
      volumes: [{ ...PACKAGE, weight: weightKg }],
      options: { insurance_value: productsTotal, receipt: false, own_hand: false }
    }),
    signal: AbortSignal.timeout(12_000)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(data)) {
    throw new Error("Não foi possível calcular o frete agora.");
  }

  return data
    .filter((service) => !service.error && service.company?.name === "Correios")
    .map((service) => ({
      id: Number(service.id),
      name: String(service.name || "").slice(0, 40),
      company: String(service.company.name || "").slice(0, 40),
      price: Number(service.custom_price || service.price),
      deliveryTime: Number(service.custom_delivery_time || service.delivery_time)
    }))
    .filter((service) =>
      Number.isFinite(service.id) &&
      Number.isFinite(service.price) && service.price >= 0 &&
      Number.isFinite(service.deliveryTime) && service.deliveryTime > 0
    );
}

module.exports = { quoteShipping };
