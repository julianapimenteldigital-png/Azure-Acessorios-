(() => {
  const productId = 6;
  const oldColor = 'Preto e Bege';
  const correctColor = 'Preto e Nude';
  const product = P[productId];

  product.co = product.co.replace(oldColor, correctColor);

  if (W[productId]?.[oldColor]) {
    W[productId][correctColor] = 'assets/variantes/p6-bege-correto.webp';
    delete W[productId][oldColor];
  }

  cart.forEach(item => {
    if (item.id === productId && item.cor === oldColor) item.cor = correctColor;
  });

  save();
  products();
  render();
})();
