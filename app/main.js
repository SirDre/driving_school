/* 
   main.js — application entry point.
   Wires the static sidebar controls to controllers and boots the app.
   This is the only script the HTML loads; everything else is imported.
 */

import { $, initModalDismiss } from './core/dom.js';
import { setSection, setConn, updateAuthUI, updateSectionAccess } from './controller/router.js';
import { toggleConnection, openSignInModal, openRegisterModal, openRolesModal, logout } from './controller/auth.js';

// Close the modal on backdrop click.
initModalDismiss();

// Sidebar navigation.
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => setSection(b.dataset.sec));

// Connection + authentication controls.
$('connBtn').onclick     = () => toggleConnection();
$('signinBtn').onclick   = () => openSignInModal();
$('registerBtn').onclick = () => openRegisterModal();
$('rolesBtn').onclick    = () => openRolesModal();
$('logoutBtn').onclick   = () => logout();

// Initial paint: chrome reflects the (restored) session, then the first section.
setConn();
updateAuthUI();
updateSectionAccess();
setSection('customers');