/* 
   model/session.js — authenticated session + role-based access control.
   Holds the signed-in user (persisted in localStorage) and answers
   "may this role see this section?". Pure model logic; no DOM, no views.
 */

const STORAGE_KEY = 'dsbps.appSession';

let appSession = load();

// called by the auth controller after sign-in/sign-out, and by the router on app load to initialize the session from localStorage.
function load() {
  try { 
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); 
  
  }catch {
    return null;
  }
}

// called by the auth controller after sign-in/sign-out, and by the router on app load to initialize the session from localStorage.
export function getSession() { 
  return appSession;
}

// sets the current session and persists it to localStorage. Pass null to clear.
export function setSession(session) {
  appSession = session;

  // check the session in localStorage against the current session.
  if (session)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else
    localStorage.removeItem(STORAGE_KEY);
  
  return appSession;
}

// clears the session both in memory and in localStorage.
export function clearSession() { 
  
  return setSession(null);
}

// --- Role-based access control -------------------------------------

// helper to check if the current session has any of the specified roles.
export function hasRole(...roles) { 
  return !!appSession?.roles?.some(role => roles.includes(role));
}
export function canManageOperations() { 
  return hasRole('ADMIN', 'STAFF'); 
}
export function canViewReports() { 
  return hasRole('ADMIN', 'REPORT'); 
}
export function canManageRoles() { 
  return hasRole('ADMIN'); 
}

// business rules for section access.
export function canAccessSection(section) {
  
  if (!appSession) 
    return false;
  
  if (hasRole('ADMIN')) 
    return true;
  
  if (section === 'reports')  
    return canViewReports();
  
  if (section === 'schedule') 
    return canManageOperations();
  
  return canManageOperations();   // customers, lessons
}