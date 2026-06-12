/*  
   controller/auth.js — Supabase connection + basic-auth flows.
   Connect/disconnect, sign in, register, logout, and the admin Roles
   panel (assign/revoke roles, reset passwords). Talks to the model
   (session + supabase client) and refreshes the chrome and view.
 */

import { state } from '../core/state.js';
import { $, toast, openModal, closeModal } from '../core/dom.js';
import { esc } from '../core/format.js';
import { connectSupabase } from '../model/supabase.js';
import { makeSupabaseDB, makeDisconnectedDB } from '../model/dataService.js';
import { setSession, clearSession, canManageRoles } from '../model/session.js';
import { connectHTML, signInHTML, registerHTML, rolesShellHTML, rolesTableHTML } from '../view/forms.js';
import { refresh, updateChrome } from './router.js';

/* ---------------- Connection ---------------- */
export function toggleConnection() {
  if (state.mode === 'connected') return disconnect();
  openSupabaseModal();
}

export function disconnect() {
  state.mode = 'disconnected';
  state.db = makeDisconnectedDB();
  state.sbClient = null;
  state.supabaseConfig = { url: '', key: '' };
  state.REF = null;
  clearSession();
  updateChrome();
  refresh();
  toast('Disconnected.');
}

export function openSupabaseModal() {
  openModal(connectHTML(state.supabaseConfig));
  $('cancel').onclick = closeModal;
  $('go').onclick = async () => {
    const url = $('sb_url').value.trim(), key = $('sb_key').value.trim();
    if (!url || !key) { toast('Project URL and anon key are required.', true); return; }
    $('go').textContent = 'Connecting…'; $('go').disabled = true;
    try {
      const sb = await connectSupabase(url, key);
      state.sbClient = sb;
      state.supabaseConfig = { url, key };
      state.db = makeSupabaseDB(sb);
      state.mode = 'connected';
      localStorage.setItem('dsbps.supabaseConfig', JSON.stringify(state.supabaseConfig));
      updateChrome(); closeModal(); refresh();
    } catch (e) {
      $('go').textContent = 'Save'; $('go').disabled = false;
      toast('Supabase connection failed: ' + (e.message || 'could not load client here'), true);
    }
  };
}

/* ---------------- Sign in / register / logout ---------------- */
export function openSignInModal() {
  if (state.mode !== 'connected' || !state.sbClient) { toast('Connect to Supabase first.', true); return; }
  openModal(signInHTML());
  $('cancel').onclick = closeModal;
  $('go').onclick = async () => {
    const email = $('login_email').value.trim(), password = $('login_password').value;
    if (!email || !password) { toast('E-mail and password are required.', true); return; }
    $('go').textContent = 'Signing in…'; $('go').disabled = true;
 
  };
}

export function openRegisterModal() {
    if (state.mode !== 'connected' || !state.sbClient) { 
        toast('Connect to Supabase first.', true); return; 
    }
    openModal(registerHTML());
    $('cancel').onclick = closeModal;
    $('go').onclick = async () => {
        const fullName = $('reg_name').value.trim(), email = $('reg_email').value.trim(), password = $('reg_password').value, role = $('reg_role').value;
        if (!fullName || !email || !password) { toast('Full name, e-mail and password are required.', true); return; }
        $('go').textContent = 'Registering…'; $('go').disabled = true;
 
    };
}

export function logout() {
  clearSession();
  updateChrome();
  refresh();
  toast('Signed out.');
}

/* ---------------- Roles admin panel ---------------- */
export function openRolesModal() {
  if (!canManageRoles()) { toast('Admin role required.', true); return; }
  openModal(rolesShellHTML());
  $('close').onclick = closeModal;
  loadRolesPanel();
}

async function loadRolesPanel() {
  const box = $('rolesBody');
 
}

async function roleAction(kind, userId) {
  const roleSelect = $('rolesBody').querySelector(`[data-role-for="${userId}"]`);
  const role = roleSelect?.value || 'STAFF';
 
}

async function setPasswordPrompt(userId) {
  const password = prompt('Enter a new password (minimum 8 characters):');
  if (password === null) return;
 
}