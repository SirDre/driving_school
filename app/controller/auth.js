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

// Disconnect by clearing the client, restoring the disconnected DB and resetting state.
export function disconnect() { 
  state.mode = 'disconnected'; 
  state.db = makeDisconnectedDB(); 
  state.sbClient = null;  
  state.supabaseConfig = { url: '', key: '' }; // Reset saved Supabase config. 
  state.REF = null; 

  clearSession(); 
  updateChrome(); 
  refresh(); 
  toast('Disconnected.');
}

// Open the connection modal, handle connection attempts and update state on success.
export function openSupabaseModal() {
  openModal(connectHTML(state.supabaseConfig));

  // Handle cancellation.
  $('cancel').onclick = closeModal;

  // Handle connection attempts.
  $('go').onclick = async () => {
    // Read the connection values.
    const url = $('sb_url').value.trim(), key = $('sb_key').value.trim();
    // Require both fields.
    if (!url || !key) { toast('Project URL and anon key are required.', true); return; }
    // Update the button state.
    $('go').textContent = 'Connecting…'; $('go').disabled = true;
    
    // Attempt the Supabase connection.
    try {
      // Create the Supabase client.
      const sb = await connectSupabase(url, key);
      // Save the client on state.
      state.sbClient = sb;
      // Store the config on state.
      state.supabaseConfig = { url, key };
      // Use the Supabase-backed DB.
      state.db = makeSupabaseDB(sb);
      // Set the connected mode.
      state.mode = 'connected';
      // Persist the connection settings.
      localStorage.setItem('dsbps.supabaseConfig', JSON.stringify(state.supabaseConfig));
      // Refresh UI and close the modal.
      updateChrome(); closeModal(); refresh();
    } catch (e) {
      // Restore the button state.
      $('go').textContent = 'Save'; $('go').disabled = false;
      // Show the connection error.
      toast('Supabase connection failed: ' + (e.message || 'could not load client here'), true);
    }
  };
}

/* ---------------- Sign in / register / logout ---------------- */
export function openSignInModal() {

  // Require an active Supabase connection.
  if (state.mode !== 'connected' || !state.sbClient) {
    // Warn if not connected.
    toast('Connect to Supabase first.', true);
    // Stop here.
    return;
  }

  // Open the sign-in form.
  openModal(signInHTML());

  // Close the modal on cancel.
  $('cancel').onclick = closeModal;
  // Handle sign-in submission.
  $('go').onclick = async () => {
    // Read credentials from the form.
    const email = $('login_email').value.trim(), password = $('login_password').value;

    // Require both values.
    if (!email || !password) {
      // Show validation feedback.
      toast('E-mail and password are required.', true);
      // Stop here.
      return;
    }
    // Update the button state.
    $('go').textContent = 'Signing in…';
    // Disable repeated clicks.
    $('go').disabled = true;
    // Call the sign-in RPC.
    try {
      // Submit credentials to Supabase.
      const { data, error } = await state.sbClient.rpc('fn_signin', { p_email: email, p_password: password });
      // Fail on RPC errors.
      if (error) throw new Error(error.message || 'Sign-in failed');
      // Fail on rejected logins.
      if (!data?.ok) throw new Error(data?.message || 'Invalid e-mail or password.');
      // Save the session in state.
      setSession({ userId: data.user_id, email: data.email, fullName: data.full_name, roles: data.roles || [] });
      // Refresh the UI after login.
      updateChrome(); closeModal(); refresh(); toast('Signed in.');
    } catch (e) {
      // Restore the button label.
      $('go').textContent = 'Sign in'; $('go').disabled = false;
      // Show the error message.
      toast('Sign-in failed: ' + (e.message || 'could not finish authentication'), true);
    }
  };
}

export function openRegisterModal() {
  // Require a connection to register.
  if (state.mode !== 'connected' || !state.sbClient) { 
    // Warn if disconnected.
    toast('Connect to Supabase first.', true);
    // Stop here.
    return;
  }
  
  // Open the registration form.
  openModal(registerHTML());

  // Attach cancel handling.
  $('cancel').onclick = closeModal;

  // Handle registration submission.
  $('go').onclick = async () => {

    // Read registration values.
    const fullName = $('reg_name').value.trim(), 
             email = $('reg_email').value.trim(),
             password = $('reg_password').value,
             role = $('reg_role').value;
    
      // Require the main fields.
      if (!fullName || !email || !password) { 
        // Show validation feedback.
        toast('Full name, e-mail and password are required.', true); 
        // Stop here.
        return; 
      }
    
    // Update the button state.
    $('go').textContent = 'Registering…'; 
    // Disable repeated clicks.
    $('go').disabled = true;
    
    // Call the register RPC.
    try {

      // Submit the registration request.
      const { data, error } = await state.sbClient.rpc('fn_register', { 
        p_email: email, p_password: password, p_full_name: fullName, p_role: role
      
      });
      
      // Fail on RPC errors.
      if (error) throw new Error(error.message || 'Registration failed');
      // Fail on rejected registrations.
      if (!data?.ok) throw new Error(data?.message || 'Registration failed');
      
      // Save the new session.
      setSession({ userId: data.user_id, email: data.email, fullName: data.full_name, roles: [data.role] });
      // Refresh the UI after registration.
      updateChrome(); closeModal(); refresh(); toast('Account created.');
    
    } catch (e) {
      // Restore the button label.
      $('go').textContent = 'Register'; $('go').disabled = false;
      // Show the error message.
      toast('Registration failed: ' + (e.message || 'could not create the account'), true);
    }
  };
}

// Log out by clearing session state.
export function logout() {
  // Remove the session.
  clearSession();
  // Refresh the chrome.
  updateChrome();
  // Refresh the page content.
  refresh();
  // Show confirmation.
  toast('Signed out.');
}

/* ---------------- Roles admin panel ---------------- */
export function openRolesModal() {
  // Require admin access.
  if (!canManageRoles()) { toast('Admin role required.', true); return; }
  // Open the roles panel shell.
  openModal(rolesShellHTML());
  // Close the panel on close.
  $('close').onclick = closeModal;
  // Load the panel data.
  loadRolesPanel();
}

async function loadRolesPanel() {
  // Get the panel container.
  const box = $('rolesBody');
  // Load users and roles together.
  try {
    // Fetch both datasets in parallel.
    const [usersRes, rolesRes] = await Promise.all([
      state.sbClient.from('vw_app_users').select('*').order('email'),
      state.sbClient.from('vw_user_roles').select('*').order('email'),
    ]);
    // Fail on user query errors.
    if (usersRes.error) throw new Error(usersRes.error.message);
    // Fail on role query errors.
    if (rolesRes.error) throw new Error(rolesRes.error.message);
    // Group roles by user id.
    const userRoles = rolesRes.data.reduce((acc, row) => { (acc[row.user_id] ||= []).push(row.role_code); return acc; }, {});
   
    // Render the table HTML.
    box.innerHTML = rolesTableHTML(usersRes.data, userRoles);
    
    // Wire assign buttons.
    box.querySelectorAll('[data-assign]').forEach(btn => btn.onclick = () => roleAction('assign', +btn.dataset.assign));
    // Wire revoke buttons.
    box.querySelectorAll('[data-revoke]').forEach(btn => btn.onclick = () => roleAction('revoke', +btn.dataset.revoke));
    // Wire password buttons.
    box.querySelectorAll('[data-pass]').forEach(btn => btn.onclick = () => setPasswordPrompt(+btn.dataset.pass));
  
  } catch (e) {
    // Show load errors safely.
    box.innerHTML = `<div class="warn">${esc(e.message || 'Could not load users')}</div>`;
  }
}

async function roleAction(kind, userId) {
  // Find the role selector for the user.
  const roleSelect = $('rolesBody').querySelector(`[data-role-for="${userId}"]`);
  // Use the selected role or default.
  const role = roleSelect?.value || 'STAFF';
  // Call the relevant role RPC.
  try {
    // Pick the correct function name.
    const fn = kind === 'assign' ? 'fn_assign_role' : 'fn_revoke_role';
    // Send the role change request.
    const { data, error } = await state.sbClient.rpc(fn, { p_user_id: userId, p_role_code: role });
    
    // Fail on RPC errors.
    if (error) throw new Error(error.message || 'Role update failed');
    // Fail on rejected updates.
    if (!data?.ok) throw new Error(data?.message || 'Role update failed');
   
    // Reload the panel state.
    await loadRolesPanel();
    // Show the update result.
    toast(data.message || 'Role updated.');

  } catch (e) { toast(e.message, true); }
}

async function setPasswordPrompt(userId) {
  // Ask for a new password.
  const password = prompt('Enter a new password (minimum 8 characters):');
  // Abort if canceled.
  if (password === null) return;
  
  // Submit the password change.
  try {

    // Call the password RPC.
    const { data, error } = await state.sbClient.rpc('fn_set_password', { 
      p_user_id: userId, p_new_password: password 
    });
    
    // Fail on RPC errors.
    if (error) throw new Error(error.message || 'Password update failed');
    // Fail on rejected changes.
    if (!data?.ok) throw new Error(data?.message || 'Password update failed');
    
    // Show success feedback.
    toast(data.message || 'Password updated.');
  
  } catch (e) { 
    // Show the error message.
    toast(e.message, true); 
  }
}