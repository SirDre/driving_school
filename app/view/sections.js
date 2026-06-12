/* 
   view/sections.js — pure templates for each page section and for the
   gate screens. Every function takes data and returns an HTML string.
   No data fetching, no event wiring (the controllers do that).
 */

import { esc, fmt$, todayISO } from '../core/format.js';
import { balPill, custStatusPill, lessonPill } from './components.js';

const staffDisplayName = s =>
  [s.nickname, [s.first_name, s.last_name].filter(Boolean).join(' ')].filter(Boolean)[0] || '—';

/* ---------------- Gate screens ---------------- */
export const connectionGateView = () => `
  <div class="card empty"><b>Supabase not connected</b>
    <div style="margin-top:10px">Use the connection button in the sidebar to enter your Supabase settings.</div>
  </div>`;

export const authGateView = () => `
  <div class="card empty"><b>Signed out</b>
    <div style="margin-top:10px">Use the sidebar to register or sign in. Admin users can manage roles and passwords after authentication.</div>
    <div style="margin-top:14px; display:flex; gap:8px; justify-content:center; flex-wrap:wrap">
      <button class="btn" id="gateSignIn">Sign in</button>
      <button class="btn ghost" id="gateRegister">Register</button>
    </div>
  </div>`;

export const accessDeniedView = () => `
  <div class="card empty"><b>Access denied</b>
    <div style="margin-top:10px">This area requires a higher role. Ask an administrator to update your account roles if needed.</div>
  </div>`;

/* ---------------- Customers ---------------- */
export function customersView(rows) {
  return `<div class="card"><div class="panel-head"><h2>All customers (${rows.length})</h2>
    <span class="muted" style="font-size:12px">Read via <span class="mono">vw_customer_full_address</span></span></div>
    <div style="overflow:auto"><table><thead><tr>
      <th>Name</th><th>Age</th><th>Status</th><th>Contact</th><th>Address</th><th class="num">Balance</th><th></th>
    </tr></thead><tbody>${rows.map(c => `<tr>
      <td class="name">${esc(c.customer_name)}</td>
      <td class="num muted">${c.age || '—'}</td>
      <td>${custStatusPill(c.status_code)}</td>
      <td class="muted">${esc(c.email || '—')}<br><span style="font-size:12px">${esc(c.cell || '')}</span></td>
      <td class="muted" style="font-size:12.5px">${esc(c.full_address)}</td>
      <td class="num">${balPill(c.balance)}</td>
      <td><div class="row-actions">
        <button class="iconbtn" title="Record payment" data-pay="${c.customer_id}">＄</button>
        <button class="iconbtn" title="Edit" data-edit="${c.customer_id}">✎</button>
        <button class="iconbtn del" title="Delete" data-del="${c.customer_id}">🗑</button>
      </div></td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ---------------- Lessons ---------------- */
export function lessonsView(rows) {
  return `<div class="card"><div class="panel-head"><h2>All lessons (${rows.length})</h2>
    <span class="muted" style="font-size:12px">Read via <span class="mono">vw_lesson_details</span> · written via <span class="mono">sp_book_lesson</span></span></div>
    <div style="overflow:auto"><table><thead><tr>
      <th>Date</th><th>Time</th><th>Customer</th><th>Instructor</th><th>Vehicle</th><th class="num">Price</th><th>Status</th><th></th>
    </tr></thead><tbody>${rows.map(l => `<tr>
      <td class="mono">${esc(l.date)}</td><td class="mono muted">${esc(l.time)}</td>
      <td class="name">${esc(l.customer)}</td>
      <td class="muted">${esc(l.instructor)}</td>
      <td class="muted" style="font-size:12.5px">${esc((l.vehicle || '').split(' - Plate')[0])}</td>
      <td class="num">${fmt$(l.price)}</td>
      <td>${lessonPill(l.status)}</td>
      <td><div class="row-actions">
        ${['Booked', 'Confirmed'].includes(l.status) ? `<button class="iconbtn" title="Cancel lesson" data-cancel="${l.lesson_id}">⊘</button>` : ''}
        <button class="iconbtn del" title="Delete" data-del="${l.lesson_id}">🗑</button>
      </div></td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ---------------- Schedule & staff ---------------- */
export function scheduleView({ today, upcoming, instr, work, staffRows, canManage }) {
  const lessonList = (arr, emptyMsg, view) => `<div class="card"><div class="panel-head"><h2>${view.title}</h2>
    <span class="muted mono" style="font-size:11.5px">${view.code}</span></div>
    ${arr.length ? `<div style="overflow:auto"><table><thead><tr><th>Date</th><th>Time</th><th>Customer</th><th>Instructor</th><th>Status</th></tr></thead>
    <tbody>${arr.map(l => `<tr><td class="mono">${esc(l.date)}</td><td class="mono muted">${esc(l.time)}</td><td class="name">${esc(l.customer)}</td><td class="muted">${esc(l.instructor)}</td><td>${lessonPill(l.status)}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="empty"><b>${emptyMsg}</b>Book one from the Lessons tab to see it here.</div>`}</div>`;

  const staffCard = canManage ? `
    <div class="card"><div class="panel-head"><h2>Instructor management</h2><span class="muted mono" style="font-size:11.5px">driving_school.staff</span></div>
      <div style="overflow:auto"><table><thead><tr><th>Instructor</th><th>Status</th><th class="num">Joined</th><th class="num">Left</th><th>Notes</th><th></th></tr></thead>
      <tbody>${staffRows.map(s => `<tr>
          <td class="name">${esc(staffDisplayName(s))}</td>
          <td>${custStatusPill(s.customer_status_code)}</td>
          <td class="num muted mono">${esc((s.date_joined_staff || '').slice(0, 10) || '—')}</td>
          <td class="num muted mono">${esc((s.date_left_staff || '').slice(0, 10) || '—')}</td>
          <td class="muted" style="font-size:12.5px">${esc(s.other_staff_details || '')}</td>
          <td><div class="row-actions">
            <button class="iconbtn" title="Edit instructor" data-staff-edit="${s.staff_id}">✎</button>
            <button class="iconbtn del" title="Delete instructor" data-staff-del="${s.staff_id}">🗑</button>
          </div></td></tr>`).join('')}</tbody></table></div></div>` : '';

  return `<div class="grid g2" style="align-items:start">
    ${lessonList(today, 'Nothing scheduled today', { title: `Today — ${todayISO()}`, code: 'vw_today_lessons' })}
    ${lessonList(upcoming, 'No upcoming lessons', { title: 'Upcoming lessons', code: 'vw_upcoming_lessons' })}
    <div class="card"><div class="panel-head"><h2>Active instructors</h2><span class="muted mono" style="font-size:11.5px">vw_active_instructors</span></div>
      <table><thead><tr><th>Instructor</th><th class="num">Age</th><th>Specialism</th></tr></thead>
      <tbody>${instr.map(s => `<tr><td class="name">${esc(s.name)}</td><td class="num muted">${s.age}</td><td class="muted" style="font-size:12.5px">${esc(s.notes)}</td></tr>`).join('')}</tbody></table></div>
    <div class="card"><div class="panel-head"><h2>Instructor workload</h2><span class="muted mono" style="font-size:11.5px">vw_instructor_workload</span></div>
      <table><thead><tr><th>Instructor</th><th class="num">Total</th><th class="num">Done</th><th class="num">Canc.</th><th class="num">Revenue</th></tr></thead>
      <tbody>${work.map(w => `<tr><td class="name">${esc(w.name)}</td><td class="num">${w.total}</td><td class="num">${w.completed}</td><td class="num muted">${w.cancelled}</td><td class="num">${fmt$(w.revenue)}</td></tr>`).join('')}</tbody></table></div>
    ${staffCard}
  </div>`;
}

/* ---------------- Reports ---------------- */
export function reportsView({ work, bal, monthly, vehicle }) {
  const r1 = [...work].sort((a, b) => b.revenue - a.revenue);
  const topRev = r1[0];
  const debtors = bal.filter(b => b.total_charged > 0)
    .map(b => ({ ...b, flag: b.calculated_outstanding <= 0 ? 'Paid up' : b.calculated_outstanding < 40 ? 'Minor balance' : 'Chase for payment' }))
    .sort((a, b) => b.calculated_outstanding - a.calculated_outstanding);
  const owed = debtors.reduce((s, d) => s + Math.max(d.calculated_outstanding, 0), 0);
  const collected = monthly.reduce((s, m) => s + Number(m.total_collected), 0);

  return `
  <div class="grid g3" style="margin-bottom:18px">
    <div class="card stat"><div class="k">Top earner</div><div class="v">${topRev ? esc(topRev.name.split(' ')[0]) : '—'}</div>
      <div class="insight" style="margin-top:10px">${topRev ? fmt$(topRev.revenue) + ' from ' + topRev.completed + ' completed lessons' : 'No data'}</div></div>
    <div class="card stat"><div class="k">Total collected</div><div class="v">${fmt$(collected)}</div>
      <div class="insight" style="margin-top:10px">Across ${monthly.reduce((s, m) => s + Number(m.num_payments), 0)} payments</div></div>
    <div class="card stat"><div class="k">Outstanding fees</div><div class="v" style="color:${owed > 0 ? 'var(--stop)' : 'var(--go)'}">${fmt$(owed)}</div>
      <div class="insight" style="margin-top:10px">${debtors.filter(d => d.flag === 'Chase for payment').length} customers to chase</div></div>
  </div>

  <div class="card" style="margin-bottom:18px"><div class="panel-head"><h2>Report 1 — Revenue &amp; reliability per instructor</h2></div>
    <div class="insight">Which instructors generate the most income and how reliable their bookings are.</div>
    <table style="margin-top:6px"><thead><tr><th>Instructor</th><th class="num">Total</th><th class="num">Completed</th><th class="num">Cancelled</th><th class="num">Completion</th><th class="num">Revenue</th></tr></thead>
    <tbody>${r1.map(w => { const pct = w.total ? Math.round(1000 * w.completed / w.total) / 10 : 0; return `<tr><td class="name">${esc(w.name)}</td><td class="num">${w.total}</td><td class="num">${w.completed}</td><td class="num muted">${w.cancelled}</td>
      <td class="num"><span class="pill ${pct >= 60 ? 'green' : pct >= 40 ? 'amber' : 'red'}">${pct}%</span></td><td class="num">${fmt$(w.revenue)}</td></tr>`; }).join('')}</tbody></table></div>

  <div class="grid g2" style="align-items:start">
    <div class="card"><div class="panel-head"><h2>Report 3 — Debtors</h2></div>
      <div class="insight">Who owes money and how much, ranked by exposure.</div>
      <table style="margin-top:6px"><thead><tr><th>Customer</th><th class="num">Charged</th><th class="num">Paid</th><th class="num">Outstanding</th><th>Action</th></tr></thead>
      <tbody>${debtors.map(d => `<tr><td class="name">${esc(d.customer_name)}</td><td class="num muted">${fmt$(d.total_charged)}</td><td class="num muted">${fmt$(d.total_paid)}</td>
        <td class="num">${fmt$(d.calculated_outstanding)}</td><td><span class="pill ${d.flag === 'Paid up' ? 'green' : d.flag === 'Minor balance' ? 'amber' : 'red'}">${d.flag}</span></td></tr>`).join('')}</tbody></table></div>

    <div class="card"><div class="panel-head"><h2>Report 4 — Vehicle utilisation</h2></div>
      <div class="insight">Which cars in the fleet are over- or under-used.</div>
      <table style="margin-top:6px"><thead><tr><th>Vehicle</th><th class="num">Assigned</th><th class="num">Completed</th><th class="num">Revenue</th></tr></thead>
      <tbody>${vehicle.map(r => `<tr><td>${esc((r.vehicle_details || '').split(' - Plate')[0])}</td><td class="num muted">${r.lessons_assigned}</td><td class="num">${r.lessons_completed}</td><td class="num">${fmt$(r.revenue_from_vehicle)}</td></tr>`).join('')}</tbody></table></div>
  </div>

  <div class="card" style="margin-top:18px"><div class="panel-head"><h2>Report 2 — Monthly revenue by payment method</h2></div>
    <div class="insight">Cash-flow pattern and the channel customers prefer to pay by.</div>
    <table style="margin-top:6px"><thead><tr><th>Month</th><th>Method</th><th class="num">Payments</th><th class="num">Collected</th></tr></thead>
    <tbody>${monthly.map(m => `<tr><td class="mono">${esc(m.pay_month)}</td><td class="muted">${esc(m.method)}</td><td class="num">${m.num_payments}</td><td class="num">${fmt$(m.total_collected)}</td></tr>`).join('')}</tbody></table></div>`;
}