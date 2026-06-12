/* 
   core/dom.js — a DOM primitives shared across the app.
   The only module (besides views' HTML strings) that knows about the DOM
   plumbing for toasts and the modal scrim. 
*/

// Shorthand element lookup by id.
export const $ = id => document.getElementById(id);

// Transient bottom toast. Pass err=true for the error styling.
export function toast(msg, err) {
  const t = $('toast');
  
  $('toastMsg').textContent = msg;
  t.classList.toggle('err', !!err);
  t.classList.add('on');
  
  setTimeout(() => t.classList.remove('on'), 2600);
}

// Modal: inject HTML into the modal container and reveal the scrim.
export function openModal(html) {
  $('modal').innerHTML = html;
  $('scrim').classList.add('on');
}

export function closeModal() {
  $('scrim').classList.remove('on');
}

// Close the modal when the backdrop (not the modal body) is clicked.
export function initModalDismiss() {
  $('scrim').addEventListener('click', e => { if (e.target === $('scrim')) closeModal(); });
}