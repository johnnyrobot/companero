// src/dialogs.js — accessible, non-blocking replacements for confirm()/alert().

function openDialog({ message, confirmLabel, cancelLabel }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const text = document.createElement('p');
    text.className = 'dialog-message';
    text.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn primary';
    confirmBtn.type = 'button';
    confirmBtn.textContent = confirmLabel;
    confirmBtn.setAttribute('data-dialog-confirm', '');

    let cancelBtn = null;
    if (cancelLabel != null) {
      cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn';
      cancelBtn.type = 'button';
      cancelBtn.textContent = cancelLabel;
      cancelBtn.setAttribute('data-dialog-cancel', '');
    }

    function close(value) {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    }
    function onKey(e) { if (e.key === 'Escape' && cancelLabel != null) close(false); }

    confirmBtn.addEventListener('click', () => close(cancelLabel != null ? true : undefined));
    cancelBtn?.addEventListener('click', () => close(false));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop && cancelLabel != null) close(false); });
    document.addEventListener('keydown', onKey);

    actions.append(confirmBtn);
    if (cancelBtn) actions.prepend(cancelBtn);
    dialog.append(text, actions);
    backdrop.append(dialog);
    document.body.append(backdrop);
    confirmBtn.focus();
  });
}

export function confirmDialog(message, { confirmLabel = 'OK', cancelLabel = 'Cancel' } = {}) {
  return openDialog({ message, confirmLabel, cancelLabel });
}

export function alertDialog(message, { confirmLabel = 'OK' } = {}) {
  return openDialog({ message, confirmLabel, cancelLabel: null });
}
