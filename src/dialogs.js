// src/dialogs.js — accessible, non-blocking replacements for confirm()/alert().

let msgCounter = 0;

function openDialog({ message, confirmLabel, cancelLabel }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    // Accessible name: link dialog to its message text via a stable, incrementing id.
    const id = 'dialog-msg-' + (++msgCounter);
    const text = document.createElement('p');
    text.className = 'dialog-message';
    text.id = id;
    text.textContent = message;
    dialog.setAttribute('aria-labelledby', id);

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

    // focusable elements in DOM order: cancelBtn (prepended) comes first, confirmBtn last.
    const focusable = cancelBtn ? [cancelBtn, confirmBtn] : [confirmBtn];

    function close(value) {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    }
    function onKey(e) {
      if (e.key === 'Escape' && cancelLabel != null) close(false);
      if (e.key === 'Tab') {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

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
