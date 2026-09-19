const modalId = "delete-confirmation-modal";

function getModal() {
  let modal = document.getElementById(modalId);
  if (modal) return modal;

  modal = document.createElement("dialog");
  modal.id = modalId;
  modal.innerHTML = `
    <article class="delete-confirmation-card">
      <header>
        <h2><i data-lucide="triangle-alert" aria-hidden="true"></i> Delete transaction?</h2>
        <button type="button" class="close" aria-label="Close confirmation"></button>
      </header>
      <p>This will permanently remove the transaction. This action cannot be undone.</p>
      <footer class="delete-confirmation-actions">
        <button type="button" class="secondary outline" data-confirm-cancel>Keep transaction</button>
        <button type="button" class="delete-confirm-button" data-confirm-delete><i data-lucide="trash-2" aria-hidden="true"></i> Delete transaction</button>
      </footer>
    </article>`;
  document.body.appendChild(modal);
  if (window.lucide) window.lucide.createIcons();
  return modal;
}

export function confirmDeleteTransaction() {
  const modal = getModal();
  return new Promise(resolve => {
    const finish = result => {
      modal.close();
      resolve(result);
    };
    modal.querySelector("[data-confirm-cancel]").onclick = () => finish(false);
    modal.querySelector("[data-confirm-delete]").onclick = () => finish(true);
    modal.querySelector(".close").onclick = () => finish(false);
    modal.oncancel = event => {
      event.preventDefault();
      finish(false);
    };
    modal.onclose = () => resolve(false);
    modal.showModal();
    modal.querySelector("[data-confirm-cancel]").focus();
  });
}

window.confirmDeleteTransaction = confirmDeleteTransaction;
