/* 
   controller/router.js — the coordinating controller.
   Owns navigation (setSection), the re-render cycle (refresh), the gate
   screens, and the "app chrome" (sidebar connection/auth indicators and
   nav enabling). Section controllers call refresh() after they mutate data.
 */

import { state, SECTIONS } from '../core/state.js';
import { $ } from '../core/dom.js';
import { esc } from '../core/format.js';
import { getSession, canAccessSection, canManageRoles, canManageOperations, hasRole } from '../model/session.js';
import { connectionGateView, authGateView, accessDeniedView } from '../view/sections.js';
import { mountCustomers } from './customers.js';
import { mountLessons } from './lessons.js';
import { mountSchedule } from './schedule.js';
import { mountReports } from './reports.js';
import { openSignInModal, openRegisterModal } from './auth.js';

// Map each section id to the controller that renders it.
const mounts = { customers: mountCustomers, lessons: mountLessons, schedule: mountSchedule, reports: mountReports };

// Set the header content in the app chrome.
function setHeader(eyebrow, title, sub) {
  $('eyebrow').textContent = eyebrow;
  $('title').textContent = title;
  $('subtitle').textContent = sub || '';
  $('headAction').innerHTML = '';
}

/* ---------------- Navigation ---------------- */
// Set the current section, update nav button states, set the header, and refresh the view.
export function setSection(sec) {
  if (!canAccessSection(sec)) {
    if (!getSession()) return renderAuthGate();
    return renderAccessDenied(sec);
  }
  state.current = sec;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.sec === sec));
  const m = SECTIONS[sec];
  setHeader(m.eyebrow, m.title, m.sub);
  refresh();
}

// Re-render the current section, gating on connection/auth/role.

// This is the main "refresh" function that all controllers call after they mutate data. 
export async function refresh() {
  const v = $('view');
        v.innerHTML = `<div class="card empty">Loading…</div>`;

  try {
    if (state.mode !== 'connected' || !state.sbClient) return renderConnectionGate();
    if (!getSession()) return renderAuthGate();
    if (!state.REF) state.REF = await state.db.refData();
    if (!canAccessSection(state.current)) return renderAccessDenied(state.current);
    const mount = mounts[state.current];
    if (mount) await mount();
  } catch (e) {
    v.innerHTML = `<div class="card empty"><b>Couldn't load data</b>${esc(e.message)}</div>`;
  }
}

/* ---------------- Gate screens ---------------- */

// If the user isn't connected to Supabase, show this screen.
function renderConnectionGate() {
  setHeader('Connection', 'Connect to Supabase', 'Enter your project settings to connect to Supabase.');

  $('view').innerHTML = connectionGateView();
}

// If the user isn't signed in, show this screen.  
function renderAuthGate() {
  setHeader('Authentication', 'Sign in required', 'Connect to Supabase, then register or sign in with the built-in basic auth roles.');

  $('view').innerHTML = authGateView();
  $('gateSignIn').onclick = () => openSignInModal();
  $('gateRegister').onclick = () => openRegisterModal();
}

// If the user is signed in but doesn't have access to the current section, show this screen.
function renderAccessDenied(section) {
  setHeader('Access', SECTIONS[section]?.title || 'Section', 'Your role does not permit this section.');

  $('view').innerHTML = accessDeniedView();
}

/* ---------------- App chrome (sidebar + nav) ---------------- */
// Update the connection status indicator in the sidebar.
export function setConn() {
  $('connDot').className = 'dot ' + (state.mode === 'connected' ? 'live' : 'red');
  $('connText').textContent = state.mode === 'connected' ? 'Connected' : 'Disconnected';
  $('connBtn').textContent = state.mode === 'connected' ? 'Disconnect' : 'Connect to Supabase';
}

// Enable/disable auth buttons based on session, and show user info if signed in.
export function updateAuthUI() {
  const session = getSession();
  const signedIn = !!session;

  $('authDot').className = 'dot ' + (signedIn ? 'live' : 'red');
  $('authText').textContent = signedIn
    ? `${session.email}`
    : 'Signed out';
  $('signinBtn').style.display = signedIn ? 'none' : 'block';
  $('registerBtn').style.display = signedIn ? 'none' : 'block';
  $('rolesBtn').style.display = signedIn && canManageRoles() ? 'block' : 'none';
  $('logoutBtn').style.display = signedIn ? 'block' : 'none';
}

// Enable/disable nav buttons based on access, and redirect if the current section is no longer accessible.
export function updateSectionAccess() {
  document.querySelectorAll('#nav button').forEach(b => b.disabled = !canAccessSection(b.dataset.sec));
  if (!canAccessSection(state.current)) {
    state.current = getSession() ? (hasRole('ADMIN') || canManageOperations() ? 'customers' : 'reports') : 'customers';
  }
}

// Refresh every chrome element at once (after connect / auth changes).
export function updateChrome() {
  setConn();
  updateAuthUI();
  updateSectionAccess();
}