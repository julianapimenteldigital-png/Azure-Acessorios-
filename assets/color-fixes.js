(() => {
  const productId = 6;
  const oldColor = 'Preto e Bege';
  const correctColor = 'Preto e Branco';
  const product = P[productId];

  product.co = product.co.replace(oldColor, correctColor);

  if (W[productId]?.[oldColor]) {
    W[productId][correctColor] = 'assets/variantes/p6-pb.webp';
    delete W[productId][oldColor];
  }

  cart.forEach(item => {
    if (item.id === productId && item.cor === oldColor) item.cor = correctColor;
  });

  save();
  products();
  render();
})();
