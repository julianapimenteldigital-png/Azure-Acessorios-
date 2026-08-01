(() => {
  "use strict";

  const paymentStyles = document.createElement("link");
  paymentStyles.rel = "stylesheet";
  paymentStyles.href = "assets/payment.css";
  document.head.appendChild(paymentStyles);

  const closeButton = document.querySelector("#close");
  const payButton = document.querySelector("#paymp");
  const payNote = document.querySelector(".paynote");
  const productCopy = document.querySelector("#produtos .copy");
  const aboutPurchase = document.querySelector("#sobre .points li:nth-child(3) span");
  const buyingCopy = document.querySelector("#comprar .copy");
  const buyingStep = document.querySelector("#comprar .stepGrid > div:nth-child(3) p");
  const faqOrder = document.querySelector(".faq details:nth-child(1) p");
  const faqPayment = document.querySelector(".faq details:nth-child(2) p");

  document.body.classList.add("mp-only");
  localStorage.removeItem("azure-pix");
  pix = false;
  render();

  closeButton.onclick = closeCart;
  payButton.textContent = "Finalizar no site com Mercado Pago";
  payNote.textContent = "Pagamento seguro no próprio site. No Pix, você recebe 5% de desconto nos produtos.";
  if (productCopy) productCopy.textContent = "Adicione os itens, calcule a entrega e finalize com segurança pelo Mercado Pago, sem sair do site.";
  if (aboutPurchase) aboutPurchase.textContent = "Compra simples: monte o carrinho, calcule a entrega e pague com segurança pelo Mercado Pago.";
  if (buyingCopy) buyingCopy.textContent = "Calcule PAC ou SEDEX e pague com segurança pelo Mercado Pago. No Pix, ganhe 5% de desconto nos produtos.";
  if (buyingStep) buyingStep.textContent = "Escolha PAC ou SEDEX e finalize pelo Mercado Pago dentro do site.";
  if (faqOrder) faqOrder.textContent = "Escolha os produtos, informe o CEP, selecione PAC ou SEDEX e finalize pelo Mercado Pago dentro do site.";
  if (faqPayment) faqPayment.textContent = "Você pode pagar por Pix ou cartão pelo Mercado Pago. Pagamentos via Pix recebem 5% de desconto nos produtos.";

  const modal = document.createElement("div");
  modal.className = "paymentModal";
  modal.id = "paymentModal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="paymentBox" role="dialog" aria-modal="true" aria-labelledby="paymentTitle">
      <button class="paymentClose" type="button" aria-label="Fechar pagamento">×</button>
      <h2 id="paymentTitle">Pagamento seguro</h2>
      <p class="paymentIntro">Escolha como deseja pagar pelo Mercado Pago.</p>
      <div class="paymentChoices">
        <button class="paymentChoice pix" type="button" data-pay-mode="pix"><b>Pix com 5% de desconto</b><span id="pixChoiceValue"></span></button>
        <button class="paymentChoice" type="button" data-pay-mode="card"><b>Cartão</b><span id="cardChoiceValue"></span></button>
      </div>
      <div class="paymentSummary"><span id="paymentModeLabel">Total</span><strong id="paymentModeTotal"></strong></div>
      <div id="paymentMessage" class="paymentLoading">Preparando o pagamento seguro…</div>
      <div id="paymentBrick_container"></div>
      <div id="statusScreenBrick_container"></div>
      <p class="paymentSecurity">Os dados de pagamento são protegidos e processados pelo Mercado Pago.</p>
    </div>`;
  document.body.appendChild(modal);

  const message = modal.querySelector("#paymentMessage");
  const paymentContainer = modal.querySelector("#paymentBrick_container");
  const statusContainer = modal.querySelector("#statusScreenBrick_container");
  const paymentTotal = modal.querySelector("#paymentModeTotal");
  const paymentLabel = modal.querySelector("#paymentModeLabel");
  const choices = [...modal.querySelectorAll("[data-pay-mode]")];
  let bricksBuilder;
  let activeMode = "pix";

  const money = (value) => R(Number(value));
  const productTotal = () => cart.reduce((sum, line) => sum + P[line.id].p * line.q, 0);
  const amountFor = (mode) => {
    const productsCents = Math.round(productTotal() * 100);
    const shippingCents = Math.round((shipping?.price || 0) * 100);
    return ((mode === "pix" ? Math.round(productsCents * 0.95) : productsCents) + shippingCents) / 100;
  };

  async function destroyBricks() {
    if (window.paymentBrickController) {
      await window.paymentBrickController.unmount().catch(() => {});
      window.paymentBrickController = null;
    }
    if (window.statusScreenBrickController) {
      await window.statusScreenBrickController.unmount().catch(() => {});
      window.statusScreenBrickController = null;
    }
    paymentContainer.innerHTML = "";
    statusContainer.innerHTML = "";
  }

  async function getBuilder() {
    if (bricksBuilder) return bricksBuilder;
    const response = await fetch("/api/mercado-pago-config", { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok || !data.publicKey) throw new Error(data.error || "O pagamento ainda não foi configurado.");
    if (typeof MercadoPago !== "function") throw new Error("Não foi possível carregar o pagamento seguro.");
    const mp = new MercadoPago(data.publicKey, { locale: "pt-BR" });
    bricksBuilder = mp.bricks();
    return bricksBuilder;
  }

  async function showStatus(paymentId) {
    await destroyBricks();
    modal.querySelector(".paymentChoices").hidden = true;
    modal.querySelector("#paymentTitle").textContent = "Acompanhe seu pagamento";
    modal.querySelector(".paymentIntro").textContent = "O status é atualizado com segurança pelo Mercado Pago.";
    message.textContent = "Carregando a confirmação…";
    message.hidden = false;
    const builder = await getBuilder();
    window.statusScreenBrickController = await builder.create("statusScreen", "statusScreenBrick_container", {
      initialization: { paymentId: String(paymentId) },
      callbacks: {
        onReady: () => { message.hidden = true; },
        onError: () => { message.className = "paymentError"; message.textContent = "Não foi possível exibir a confirmação. Consulte o pagamento no aplicativo Mercado Pago."; }
      }
    });
  }

  async function renderPayment(mode) {
    activeMode = mode;
    choices.forEach((choice) => choice.classList.toggle("active", choice.dataset.payMode === mode));
    paymentLabel.textContent = mode === "pix" ? "Total no Pix (5% de desconto)" : "Total no cartão";
    paymentTotal.textContent = money(amountFor(mode));
    message.className = "paymentLoading";
    message.textContent = "Carregando as opções do Mercado Pago…";
    message.hidden = false;
    modal.querySelector(".paymentChoices").hidden = false;
    await destroyBricks();

    try {
      const builder = await getBuilder();
      const paymentMethods = mode === "pix"
        ? { bankTransfer: "pix" }
        : { creditCard: "all", debitCard: "all", prepaidCard: "all" };
      window.paymentBrickController = await builder.create("payment", "paymentBrick_container", {
        initialization: { amount: amountFor(mode) },
        customization: {
          paymentMethods,
          visual: { style: { theme: "default" } }
        },
        callbacks: {
          onReady: () => { message.hidden = true; },
          onSubmit: ({ formData }) => new Promise(async (resolve, reject) => {
            try {
              message.className = "paymentLoading";
              message.textContent = "Processando com segurança…";
              message.hidden = false;
              const response = await fetch("/api/processar-pagamento", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  payment: formData,
                  cart,
                  cep: document.querySelector("#cep").value.replace(/\D/g, ""),
                  shippingId: shipping.id
                })
              });
              const data = await response.json();
              if (!response.ok || !data.paymentId) throw new Error(data.error || "Não foi possível concluir o pagamento.");
              resolve();
              if (data.status === "approved") {
                cart.splice(0, cart.length);
                clearShipping();
                render();
              }
              setTimeout(() => showStatus(data.paymentId).catch(() => {
                message.className = "paymentError";
                message.textContent = "Pagamento criado. Consulte a confirmação no aplicativo Mercado Pago.";
                message.hidden = false;
              }), 100);
            } catch (error) {
              message.className = "paymentError";
              message.textContent = error.message;
              message.hidden = false;
              reject();
            }
          }),
          onError: () => {
            message.className = "paymentError";
            message.textContent = "Não foi possível carregar esta opção. Feche e tente novamente.";
            message.hidden = false;
          }
        }
      });
    } catch (error) {
      message.className = "paymentError";
      message.textContent = error.message;
      message.hidden = false;
    }
  }

  async function openPayment() {
    if (!cart.length || !shipping) return;
    closeCart();
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    modal.querySelector("#paymentTitle").textContent = "Pagamento seguro";
    modal.querySelector(".paymentIntro").textContent = "Escolha como deseja pagar pelo Mercado Pago.";
    modal.querySelector("#pixChoiceValue").textContent = `${money(amountFor("pix"))} — desconto automático`;
    modal.querySelector("#cardChoiceValue").textContent = money(amountFor("card"));
    await renderPayment("pix");
  }

  async function closePayment() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    await destroyBricks();
  }

  choices.forEach((choice) => choice.addEventListener("click", () => renderPayment(choice.dataset.payMode)));
  modal.querySelector(".paymentClose").addEventListener("click", closePayment);
  modal.addEventListener("click", (event) => { if (event.target === modal) closePayment(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && modal.classList.contains("open")) closePayment(); });
  payButton.onclick = openPayment;
})();
