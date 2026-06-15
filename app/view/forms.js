/* 
   view/forms.js — pure HTML builders for the modal dialogs.
   Each returns a string for openModal(...). Controllers supply the data,
   open the modal, then wire the buttons. No fetching or event wiring here.
 */

import { esc, fmt$, todayISO, nowLocalISO, tsLocal } from '../core/format.js';
import { state } from '../core/state.js';
import { statusOptions, addressSectionHTML } from './components.js';

const staffDisplayName = row =>
  [row?.nickname, [row?.first_name, row?.last_name].filter(Boolean).join(' ')].filter(Boolean)[0] || 'instructor';

/* ---------------- Customer form ---------------- */
export function customerFormHTML(c, addrA, isEdit) {
  return `<div class="mhead"><h3>${isEdit ? 'Edit customer' : 'New customer'}</h3>
    <p>${isEdit ? 'Update the learner-driver record.' : 'Add a learner driver to the system.'}</p></div>
    <div class="mbody">
      <div class="ftwo">
        <div class="field"><label>First name</label><input id="f_first" value="${esc(c?.first || '')}"></div>
        <div class="field"><label>Last name</label><input id="f_last" value="${esc(c?.last || '')}"></div>
      </div>
      <div class="ftwo">
        <div class="field"><label>Date of birth</label><input id="f_dob" type="date" value="${esc(c?.dob || '')}"></div>
        <div class="field"><label>Customer since</label><input id="f_since" type="date" value="${esc(c?.since || todayISO())}"></div>
      </div>
      <div class="field"><label>Status</label><select id="f_status">${statusOptions(c?.status_code || 'ACT')}</select></div>
      <div class="field"><label>Email</label><input id="f_email" type="email" value="${esc(c?.email || '')}" placeholder="name@example.ca"></div>
      <div class="field"><label>Mobile</label><input id="f_cell" type="tel" inputmode="tel" value="${esc(c?.cell || '')}" placeholder="(587) 555-0000"></div>
      ${addressSectionHTML('c', addrA, isEdit)}
    </div>
    <div class="mfoot"><button class="btn ghost" id="cancel">Cancel</button><button class="btn" id="save">${isEdit ? 'Save customer' : 'Add customer'}</button></div>`;
}

/* ---------------- Payment form ---------------- */
export function paymentFormHTML(c) {
  return `<div class="mhead"><h3>Record payment</h3><p>For ${esc(c.customer_name)} — current balance ${fmt$(c.balance)}.</p></div>
    <div class="mbody">
      <div class="ftwo">
        <div class="field"><label>Amount (CAD)</label><input id="p_amt" type="number" step="0.01" min="0.01" placeholder="0.00"></div>
        <div class="field"><label>Method</label><select id="p_method">${Object.entries(state.REF.methods).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Note (optional)</label><input id="p_note" placeholder="e.g. Lesson 3 paid"></div>
      <div class="hint" style="font-size:12px;color:var(--ink-faint)">The balance is reduced automatically by the payment trigger.</div>
    </div>
    <div class="mfoot"><button class="btn ghost" id="cancel">Cancel</button><button class="btn go" id="save">Record payment</button></div>`;
}

/* ---------------- Lesson booking form ---------------- */
export function lessonFormHTML(l, isEdit = false) {
  const selected = (a, b) => String(a ?? '') === String(b ?? '') ? ' selected' : '';
  const custOpts = state.REF.customers
    .map(c => `<option value="${c.id}"${selected(c.id, l?.cust)}>${esc(c.name)}${c.status === 'SUS' ? ' (suspended)' : ''}</option>`)
    .join('');
  const staffOpts = state.REF.staff
    .filter(s => !s.left && !/administrator/i.test(s.notes))
    .map(s => `<option value="${s.id}"${selected(s.id, l?.staff)}>${esc(s.first + ' ' + s.last)}</option>`)
    .join('');
  const vehOpts = state.REF.vehicles
    .map(v => `<option value="${v.id}"${selected(v.id, l?.veh)}>${esc(v.details.split(' - Plate')[0])}</option>`)
    .join('');

  return `<div class="mhead"><h3>${isEdit ? 'Edit lesson' : 'Book a lesson'}</h3><p>Validated against suspensions and instructor/vehicle double-booking.</p></div>
    <div class="mbody">
      <div class="field"><label>Customer</label><select id="b_cust">${custOpts}</select></div>
      <div class="ftwo">
        <div class="field"><label>Instructor</label><select id="b_staff"><option value="">— none —</option>${staffOpts}</select></div>
        <div class="field"><label>Vehicle</label><select id="b_veh"><option value="">— none —</option>${vehOpts}</select></div>
      </div>
      <div class="ftwo">
        <div class="field"><label>Date</label><input id="b_date" type="date" value="${esc(l?.date || todayISO())}"></div>
        <div class="field"><label>Time</label><input id="b_time" type="time" value="${esc(l?.time || '09:00')}"></div>
      </div>
      <div class="ftwo">
        <div class="field"><label>Price (CAD)</label><input id="b_price" type="number" step="0.01" min="0" value="${esc(l?.price ?? '70.00')}"></div>
        <div class="field"><label>Notes</label><input id="b_notes" value="${esc(l?.notes || '')}" placeholder="e.g. Highway intro"></div>
      </div>
    </div>
    <div class="mfoot"><button class="btn ghost" id="cancel">Cancel</button><button class="btn" id="save">${isEdit ? 'Save lesson' : 'Book lesson'}</button></div>`;
}

/* ---------------- Instructor (staff) form ---------------- */
export function staffFormHTML(row, addrA, isEdit) {
  return `<div class="mhead"><h3>${isEdit ? 'Edit instructor' : 'Add instructor'}</h3><p>${isEdit ? 'Update the staff record.' : 'Create a new driving instructor record.'}</p></div>
    <div class="mbody">
      <div class="ftwo">
        <div class="field"><label>First name</label><input id="s_first" value="${esc(row?.first_name || '')}"></div>
        <div class="field"><label>Last name</label><input id="s_last" value="${esc(row?.last_name || '')}"></div>
      </div>
      <div class="ftwo">
        <div class="field"><label>Nickname</label><input id="s_nick" value="${esc(row?.nickname || '')}"></div>
        <div class="field"><label>Middle name</label><input id="s_middle" value="${esc(row?.middle_name || '')}"></div>
      </div>
      <div class="ftwo">
        <div class="field"><label>Date of birth</label><input id="s_dob" type="date" value="${esc(row?.date_of_birth || '')}"></div>
        <div class="field"><label>Status</label><select id="s_status">${statusOptions(row?.customer_status_code || 'ACT')}</select></div>
      </div>
      ${addressSectionHTML('s', addrA, isEdit)}
      <div class="ftwo">
        <div class="field"><label>Joined</label><input id="s_joined" type="datetime-local" value="${esc(isEdit ? tsLocal(row?.date_joined_staff) : nowLocalISO())}"></div>
        <div class="field"><label>Left</label><input id="s_left" type="datetime-local" value="${esc(tsLocal(row?.date_left_staff))}"></div>
      </div>
      <div class="field"><label>Details</label><textarea id="s_notes" rows="4">${esc(row?.other_staff_details || '')}</textarea></div>
    </div>
    <div class="mfoot"><button class="btn ghost" id="cancel">Cancel</button><button class="btn" id="save">${isEdit ? 'Save instructor' : 'Add instructor'}</button></div>`;
}

/* ---------------- Confirmation dialogs ---------------- */
export function deleteCustomerHTML(c) {
  return `<div class="mhead"><h3>Delete customer</h3><p>This permanently removes <b>${esc(c.customer_name)}</b> and their payment history. Lessons on record will block the delete (RESTRICT).</p></div>
    <div class="mbody">
      <div class="warn">This can't be undone. Type the customer's name to confirm.</div>
      <div class="field"><label>Type “${esc(c.customer_name)}”</label><input id="confirmName" placeholder="${esc(c.customer_name)}" autocomplete="off"></div>
    </div>
    <div class="mfoot"><button class="btn ghost" id="cancel">Keep customer</button><button class="btn danger" id="del" disabled style="opacity:.5">Delete customer</button></div>`;
}

export function deleteLessonHTML(l) {
  return `<div class="mhead"><h3>Delete lesson</h3><p>Remove the lesson for <b>${esc(l.customer)}</b> on ${esc(l.date)} at ${esc(l.time)}?</p></div>
    <div class="mbody"><div class="warn">Deleting removes the booking record entirely. To keep history, use <b>Cancel lesson</b> instead.</div></div>
    <div class="mfoot"><button class="btn ghost" id="cancel">Keep lesson</button><button class="btn danger" id="del">Delete lesson</button></div>`;
}

export function cancelLessonHTML() {
  return `<div class="mhead"><h3>Cancel lesson</h3><p>The 24-hour rule applies: cancelled 24h+ ahead → free (Cancelled); otherwise it stays billable as a No show.</p></div>
    <div class="mbody"><div class="warn">This applies the cancellation policy via <span class="mono">sp_cancel_lesson</span>.</div></div>
    <div class="mfoot"><button class="btn ghost" id="cancel">Back</button><button class="btn" id="go">Apply cancellation</button></div>`;
}

export function deleteStaffHTML(row) {
  return `<div class="mhead"><h3>Delete instructor</h3><p>This permanently removes <b>${esc(staffDisplayName(row))}</b>.</p></div>
    <div class="mbody"><div class="warn">This action is blocked if the instructor is still referenced by lessons or tests.</div></div>
    <div class="mfoot"><button class="btn ghost" id="cancel">Keep instructor</button><button class="btn danger" id="del">Delete instructor</button></div>`;
}

/* ---------------- Auth / connection dialogs ---------------- */
export function connectHTML(config) {
  return `<div class="mhead"><h3>Connect to Supabase</h3><p>Enter your project settings.</p></div>
    <div class="mbody">
      <div class="field"><label>Project URL</label><input id="sb_url" value="${esc(config.url)}" placeholder="https://YOUR-REF.supabase.co"></div>
      <div class="field"><label>Anon key</label><input id="sb_key" value="${esc(config.key)}" placeholder="eyJ..."></div>
      <div class="hint" style="font-size:12px">This validates the driving_school schema.</div>
    </div>
    <div class="mfoot"><button class="btn ghost" id="cancel">Cancel</button><button class="btn go" id="go">Save</button></div>`;
}

export function signInHTML() {
  return `<div class="mhead"><h3>Sign in</h3><p>Use the account created by the built-in register flow.</p></div>
    <div class="mbody">
      <div class="field"><label>E-mail</label><input id="login_email" type="email" placeholder="name@example.ca"></div>
      <div class="field"><label>Password</label><input id="login_password" type="password" placeholder="••••••••"></div>
      <div class="hint" style="font-size:12px">Signing in loads the roles from app_user_roles and unlocks the permitted sections.</div>
    </div>
    <div class="mfoot"><button class="btn ghost" id="cancel">Cancel</button><button class="btn go" id="go">Sign in</button></div>`;
}

export function registerHTML() {
  return `<div class="mhead"><h3>Register</h3><p>Create an account and choose a starting role.</p></div>
    <div class="mbody">
      <div class="ftwo">
        <div class="field"><label>Full name</label><input id="reg_name" placeholder="Jane Doe"></div>
        <div class="field"><label>E-mail</label><input id="reg_email" type="email" placeholder="name@example.ca"></div>
      </div>
      <div class="ftwo">
        <div class="field"><label>Password</label><input id="reg_password" type="password" placeholder="At least 8 characters"></div>
        <div class="field"><label>Role</label><select id="reg_role"><option value="STAFF">STAFF</option><option value="REPORT">REPORT</option><option value="ADMIN">ADMIN</option></select></div>
      </div>
      <div class="hint" style="font-size:12px">Roles control which sections and admin tools the account can access.</div>
    </div>
    <div class="mfoot"><button class="btn ghost" id="cancel">Cancel</button><button class="btn go" id="go">Register</button></div>`;
}

export function rolesShellHTML() {
  return `<div class="mhead"><h3>Roles</h3><p>Assign roles, revoke roles, or reset passwords for app users.</p></div>
    <div class="mbody"><div id="rolesBody">Loading…</div></div>
    <div class="mfoot"><button class="btn ghost" id="close">Close</button></div>`;
}

export function rolesTableHTML(users, userRoles) {
  return `<table><thead><tr><th>User</th><th>Roles</th><th></th></tr></thead><tbody>${users.map(u => {
    const roles = userRoles[u.user_id] || (u.roles ? String(u.roles).split(',').filter(Boolean) : []);
    return `<tr>
      <td><div class="name">${esc(u.full_name || u.email)}</div><div class="muted" style="font-size:12px">${esc(u.email)}</div></td>
      <td class="muted">${roles.length ? roles.map(r => `<span class="pill blue" style="margin-right:4px">${esc(r)}</span>`).join(' ') : '—'}</td>
      <td>
        <div class="field" style="margin:0 0 6px 0"><select data-role-for="${u.user_id}"><option value="STAFF">STAFF</option><option value="REPORT">REPORT</option><option value="ADMIN">ADMIN</option></select></div>
        <div class="row-actions" style="justify-content:flex-start; flex-wrap:wrap">
          <button class="iconbtn" data-assign="${u.user_id}" title="Assign role"><i class="fa-solid fa-plus" aria-hidden="true"></i ></button>
          <button class="iconbtn" data-revoke="${u.user_id}" title="Revoke role"><i class="fa-solid fa-times" aria-hidden="true"></i></button>
          <button class="iconbtn" data-pass="${u.user_id}" title="Set password"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
          <button class="iconbtn danger" data-del-user="${u.user_id}" title="Delete user"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('')}</tbody></table>`;
}