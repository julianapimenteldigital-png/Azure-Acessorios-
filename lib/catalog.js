const PRODUCTS = [
  { id: 0, name: "Tiara Gabriela Ondulada", price: 82.90, weightGrams: 14, stock: 54, colors: ["Preto", "Preto e Branco", "Madrepérola", "Onça", "Tartaruga"] },
  { id: 1, name: "Tiara Camila Reta", price: 58.90, weightGrams: 7, stock: 12, colors: ["Madrepérola", "Tartaruga"] },
  { id: 2, name: "Pente Crab Médio", price: 82.90, weightGrams: 14, stock: 12, colors: ["Madrepérola", "Tartaruga"] },
  { id: 3, name: "Prendedor Rome Grande", price: 82.90, weightGrams: 17, stock: 40, colors: ["Madrepérola", "Preto", "Onça", "Tartaruga"] },
  { id: 4, name: "Prendedor São Paulo Grande", price: 89.90, weightGrams: 21, stock: 30, colors: ["Onça", "Preto", "Tartaruga"] },
  { id: 5, name: "Prendedor Rome Médio", price: 82.90, weightGrams: 11, stock: 30, colors: ["Preto e Branco", "Onça", "Preto"] },
  { id: 6, name: "Prendedor São Paulo Médio", price: 89.90, weightGrams: 12, stock: 25, colors: ["Preto e Bege", "Madrepérola", "Preto"] },
  { id: 7, name: "Prendedor Rome Intermediário", price: 82.90, weightGrams: 6, stock: 20, colors: ["Madrepérola", "Tartaruga"] },
  { id: 8, name: "Prendedor Madrid Médio", price: 82.90, weightGrams: 12, stock: 40, colors: ["Preto", "Madrepérola", "Glitter Dourado"] },
  { id: 9, name: "Prendedor São Paulo Intermediário", price: 86.90, weightGrams: 7, stock: 26, colors: ["Preto e Branco", "Onça", "Tartaruga"] },
  { id: 10, name: "Prendedor Antuérpia Médio", price: 89.90, weightGrams: 14, stock: 30, colors: ["Madrepérola", "Tartaruga", "Preto"] }
];

function validateCart(rawCart) {
  if (!Array.isArray(rawCart) || rawCart.length === 0) throw new Error("Carrinho vazio.");
  if (rawCart.length > 33) throw new Error("Carrinho acima do limite permitido.");
  const used = new Map();
  let totalQuantity = 0;
  return rawCart.map((line) => {
    const product = PRODUCTS[Number(line.id)];
    const quantity = Number(line.q);
    const color = String(line.cor || "");
    if (!product || !Number.isInteger(quantity) || quantity < 1 || !product.colors.includes(color)) {
      throw new Error("Há um item inválido no carrinho.");
    }
    const nextUsed = (used.get(product.id) || 0) + quantity;
    if (nextUsed > product.stock) throw new Error(`Quantidade indisponível para ${product.name}.`);
    totalQuantity += quantity;
    if (totalQuantity > 100) throw new Error("Carrinho acima do limite permitido.");
    used.set(product.id, nextUsed);
    return { product, quantity, color };
  });
}

function totals(lines) {
  const productsTotal = Number(lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0).toFixed(2));
  const weightGrams = 47 + lines.reduce((sum, line) => sum + line.product.weightGrams * line.quantity, 0);
  return { productsTotal, weightKg: Math.max(0.1, Number((weightGrams / 1000).toFixed(3))) };
}

module.exports = { PRODUCTS, validateCart, totals };
