/* 
   view/components.js — reusable view pieces (pure-ish; read-only state).
   Status pills, <select> option builders, and the shared address picker
   used by both the customer and instructor forms. The address picker is a
   small "component": it owns its template, its wiring, and reading values
   back out, so the two forms don't duplicate that logic.
 */

import { esc, fmt$ } from '../core/format.js';
import { $ } from '../core/dom.js';
import { state } from '../core/state.js';

// --- Status pills (traffic-light semantics) ------------------------
export function balPill(b) {
  const n = Number(b);
  if (n <= 0) return `<span class="pill green">Paid up</span>`;
  if (n < 40)  return `<span class="pill amber">${fmt$(n)}</span>`;
  return `<span class="pill red">${fmt$(n)}</span>`;
}

export function custStatusPill(code) {
  const map = { ACT: 'green', PASS: 'blue', SUS: 'red', INA: 'grey', LEAD: 'amber' };
  return `<span class="pill ${map[code] || 'grey'}">${esc(state.REF.custStatus[code] || code)}</span>`;
}

export function lessonPill(s) {
  const map = { Completed: 'green', Confirmed: 'blue', Booked: 'amber',
    'Cancelled by customer': 'grey', 'No show': 'red', Rescheduled: 'grey' };
  return `<span class="pill ${map[s] || 'grey'}">${esc(s)}</span>`;
}

// Customer-status <option> list for the form selects.
export function statusOptions(sel) {
  return Object.entries(state.REF.custStatus)
    .map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(v)}</option>`)
    .join('');
}

/* ---------------- Address picker component ----------------
   Reused by the customer and instructor forms. `p` is a field-id prefix
   ("c" or "s") so the two instances don't collide on the same page. */

// HTML for the search box + the seven address columns. `A` pre-fills on edit.
export function addressSectionHTML(p, A = {}, isEdit = false) {
  const av = k => esc(A[k] || '');
  return `
    <div class="addr-sep">Address</div>
    <div class="field addr-box">
      <div class="addr-head"><label>Search existing address</label>
        <button type="button" class="addr-clear" id="${p}_addr_clear">Clear address</button></div>
      <input id="${p}_addr_search" placeholder="Search by street, area, city or postcode…" autocomplete="off">
      <div class="addr-results" id="${p}_addr_results"></div>
      <div class="hint">Pick a match to autofill the fields, or type a new address below — it will be created automatically.</div>
    </div>
    <div class="ftwo">
      <div class="field"><label>Building / number (line 1)</label><input id="${p}_line1" value="${av('line_1_number_building')}"></div>
      <div class="field"><label>Street (line 2)</label><input id="${p}_line2" value="${av('line_2_number_street')}"></div>
    </div>
    <div class="ftwo">
      <div class="field"><label>Area / locality (line 3)</label><input id="${p}_line3" value="${av('line_3_area_locality')}"></div>
      <div class="field"><label>City</label><input id="${p}_city" value="${av('city')}"></div>
    </div>
    <div class="ftwo">
      <div class="field"><label>Postal / ZIP code</label><input id="${p}_post" value="${av('zip_postcode')}"></div>
      <div class="field"><label>Province / state / county</label><input id="${p}_prov" value="${av('state_province_county')}"></div>
    </div>
    <div class="field"><label>Country</label><input id="${p}_country" value="${isEdit ? av('country') : 'Canada'}" placeholder="Canada"></div>`;
}

const addrLabel = a => [a.line_1_number_building, a.line_2_number_street, a.line_3_area_locality, a.city, a.zip_postcode]
  .filter(Boolean).join(', ');

// Wire the search box and clear button for the picker identified by `p`.
export function wireAddressPicker(p, addresses) {
  const fill = a => {
    $(`${p}_line1`).value = a.line_1_number_building || '';
    $(`${p}_line2`).value = a.line_2_number_street || '';
    $(`${p}_line3`).value = a.line_3_area_locality || '';
    $(`${p}_city`).value  = a.city || '';
    $(`${p}_post`).value  = a.zip_postcode || '';
    $(`${p}_prov`).value  = a.state_province_county || '';
    $(`${p}_country`).value = a.country || 'Canada';
  };
  const clear = () => { ['line1', 'line2', 'line3', 'city', 'post', 'prov'].forEach(s => $(`${p}_${s}`).value = ''); $(`${p}_country`).value = 'Canada'; };

  const searchEl = $(`${p}_addr_search`), resEl = $(`${p}_addr_results`);
  searchEl.oninput = () => {
    const q = searchEl.value.trim().toLowerCase();
    if (!q) { resEl.classList.remove('on'); resEl.innerHTML = ''; return; }
    const hits = addresses.filter(a => [a.line_1_number_building, a.line_2_number_street, a.line_3_area_locality, a.city, a.zip_postcode, a.state_province_county]
      .some(x => (x || '').toLowerCase().includes(q))).slice(0, 8);
    if (!hits.length) { resEl.innerHTML = '<div class="addr-none">No match — type the new address in the fields below.</div>'; resEl.classList.add('on'); return; }
    resEl.innerHTML = hits.map((a, i) => `<div class="addr-result" data-i="${i}"><b>${esc(addrLabel(a))}</b>`
      + `<small>${esc([a.state_province_county, a.country].filter(Boolean).join(' · '))} · #${a.address_id}</small></div>`).join('');
    resEl.classList.add('on');
    resEl.querySelectorAll('.addr-result').forEach(elm => elm.onclick = () => { fill(hits[+elm.dataset.i]); resEl.classList.remove('on'); searchEl.value = ''; });
  };
  $(`${p}_addr_clear`).onclick = () => { clear(); searchEl.value = ''; resEl.classList.remove('on'); };
}

// Read the seven address fields back into an object.
export function readAddressFields(p) {
  const g = id => $(`${p}_${id}`).value.trim();
  return {
    line_1_number_building: g('line1'), line_2_number_street: g('line2'), line_3_area_locality: g('line3'),
    city: g('city'), zip_postcode: g('post'), state_province_county: g('prov'), country: g('country'),
  };
}

// Did the user actually enter an address? (country defaulting to Canada doesn't count.)
export function addressHasInput(addr) {
  return ['line_1_number_building', 'line_2_number_street', 'line_3_area_locality', 'city', 'zip_postcode', 'state_province_county']
    .some(k => addr[k]);
}