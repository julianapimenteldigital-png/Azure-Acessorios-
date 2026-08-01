(() => {
  const email = 'contato@azureacessorios.com';
  const footer = document.querySelector('footer');

  if (!footer) return;

  const separator = document.createElement('span');
  separator.textContent = ' · ';

  const link = document.createElement('a');
  link.href = `mailto:${email}`;
  link.textContent = email;
  link.setAttribute('aria-label', 'Enviar e-mail para a Azure Acessórios');
  link.style.color = '#ffffff';
  link.style.fontWeight = '600';

  footer.append(separator, link);
})();
