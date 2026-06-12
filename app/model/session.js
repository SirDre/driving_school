/* 
   model/session.js — authenticated session + role-based access control.
   Holds the signed-in user (persisted in localStorage) and answers
   "may this role see this section?". Pure model logic; no DOM, no views.
 */

const STORAGE_KEY = 'dsbps.appSession';

let appSession = load();

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
  catch { return null; }
}

export function getSession() { return appSession; }

export function setSession(session) {
  appSession = session;
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
  return appSession;
}

export function clearSession() { return setSession(null); }

// --- Role-based access control -------------------------------------
export function hasRole(...roles) { return !!appSession?.roles?.some(role => roles.includes(role)); }
export function canManageOperations() { return hasRole('ADMIN', 'STAFF'); }
export function canViewReports()      { return hasRole('ADMIN', 'REPORT'); }
export function canManageRoles()      { return hasRole('ADMIN'); }

// business rules for section access.
export function canAccessSection(section) {
  if (!appSession) 
    return false;
  
  if (hasRole('ADMIN')) 
    return true;
  
  if (section === 'reports')  
    return canViewReports();
  
  if (section === 'schedule') 
    return hasRole('STAFF');
  
  return canManageOperations();   // customers, lessons
}