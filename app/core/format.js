/* 
   core/format.js — pure formatting helpers (no DOM, no state).
   Used by views and controllers for display formatting.
 */

// "Now" reference for age calculations and date defaults.
export const TODAY = new Date();

// Money in Canadian dollars, always 2dp.
export const fmt$ = n => 'CA$' + Number(n || 0).toFixed(2);

// HTML-escape any value before injecting into innerHTML.
export const esc = s => String(s ?? '').replace(/[&<>"]/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Whole-year age from an ISO date of birth.
export const ageFrom = dob => {
  if (!dob) return '';
  const d = new Date(dob), t = new Date(TODAY);
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
  return a;
};

// Today's date as yyyy-mm-dd, suitable for <input type="date">.
export const todayISO = () => new Date().toISOString().slice(0, 10);

// Now as yyyy-mm-ddThh:mm, suitable for <input type="datetime-local">.
export const nowLocalISO = () => new Date().toISOString().slice(0, 16);

// Convert a stored timestamp to the datetime-local input format (or '').
export const tsLocal = v => (v ? new Date(v).toISOString().slice(0, 16) : '');