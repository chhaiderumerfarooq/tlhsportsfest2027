/*
 * Small UI helpers: toasts, dialogs, copy buttons, count-up and celebration.
 */

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function showToast(message, type = 'info', duration = 4200) {
  const region = qs('#toast-region');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  region.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add('toast-out');
    window.setTimeout(() => toast.remove(), 260);
  }, duration);
}

let savedTimer = null;
export function showSavedNote(text = 'Progress saved on this device') {
  const note = qs('#saved-note');
  if (!note) return;
  note.textContent = text;
  note.classList.add('is-visible');
  clearTimeout(savedTimer);
  savedTimer = window.setTimeout(() => note.classList.remove('is-visible'), 2600);
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    // Fall through to execCommand.
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '-9999px';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.focus();
  area.select();
  area.setSelectionRange(0, area.value.length);
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (error) {
    copied = false;
  }
  area.remove();
  return copied;
}

export function markCopied(button) {
  if (!button) return;
  if (button.dataset.copying === '1') return;
  button.dataset.copying = '1';
  const original = button.innerHTML;
  button.classList.add('is-copied');
  button.innerHTML = '<span class="copy-icon" aria-hidden="true">✓</span><span class="copy-text">Copied</span>';
  showToast('Copied', 'success', 1500);
  window.setTimeout(() => {
    button.classList.remove('is-copied');
    button.innerHTML = original;
    delete button.dataset.copying;
  }, 1900);
}

export function countUp(element, from, to, formatter, duration = 520) {
  if (!element) return;
  const start = Number(from) || 0;
  const end = Number(to) || 0;
  if (prefersReducedMotion() || start === end || duration <= 0) {
    element.textContent = formatter(end);
    return;
  }
  const startTime = performance.now();
  function frame(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(start + (end - start) * eased);
    element.textContent = formatter(value);
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

export function setBusy(button, busy, busyLabel = 'Please wait…') {
  if (!button) return;
  if (busy) {
    if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = '<span class="spinner" aria-hidden="true"></span>' + escapeHtml(busyLabel);
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
}

export function focusFirstError(root = document) {
  const target = root.querySelector('[aria-invalid="true"], .field-error:not(:empty)');
  if (!target) return;
  if (target.classList.contains('field-error')) {
    const field = root.querySelector('[data-error-for="' + target.dataset.errorFor + '"]');
    if (field && field.focus) {
      field.focus();
      field.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
    return;
  }
  target.focus();
  target.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

export function openDialog(dialog) {
  if (!dialog) return;
  if (dialog.open) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

export function closeDialog(dialog) {
  if (!dialog) return;
  if (dialog.open && typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

export function closeAllDialogs() {
  qsa('dialog[open]').forEach((dialog) => closeDialog(dialog));
}

/**
 * Generic message dialog. actions: [{label, style, onClick, keepOpen}]
 */
export function showMessageDialog({ title, bodyHtml, actions = [] }) {
  const dialog = qs('#message-dialog');
  const titleEl = qs('#message-dialog-title');
  const bodyEl = qs('#message-dialog-body');
  const actionsEl = qs('#message-dialog-actions');
  if (!dialog || !titleEl || !bodyEl || !actionsEl) return;
  titleEl.textContent = title || 'Please check';
  bodyEl.innerHTML = bodyHtml || '';
  actionsEl.innerHTML = '';
  const list = actions.length ? actions : [{ label: 'Close', style: 'secondary' }];
  list.forEach((action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-' + (action.style || 'secondary');
    button.textContent = action.label;
    button.addEventListener('click', async () => {
      if (action.onClick) await action.onClick();
      if (!action.keepOpen) closeDialog(dialog);
    });
    actionsEl.appendChild(button);
  });
  openDialog(dialog);
}

export function celebrate(container) {
  if (!container || prefersReducedMotion()) return;
  const layer = document.createElement('div');
  layer.className = 'celebration';
  layer.setAttribute('aria-hidden', 'true');
  const colors = ['#FFCE40', '#F8AA14', '#E45C06', '#C83806', '#A00509', '#FFF8F0'];
  for (let i = 0; i < 42; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.setProperty('--x', (Math.random() * 100).toFixed(2) + '%');
    piece.style.setProperty('--delay', (Math.random() * 0.6).toFixed(2) + 's');
    piece.style.setProperty('--duration', (1.7 + Math.random() * 1.4).toFixed(2) + 's');
    piece.style.setProperty('--drift', ((Math.random() - 0.5) * 160).toFixed(0) + 'px');
    piece.style.setProperty('--rotate', Math.round(Math.random() * 720 - 360) + 'deg');
    piece.style.setProperty('--color', colors[i % colors.length]);
    layer.appendChild(piece);
  }
  container.appendChild(layer);
  window.setTimeout(() => layer.remove(), 3600);
}

export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}
