/* 
   core/state.js — shared, mutable application state (a tiny store).
   Controllers mutate it; views read from it (REF lookups). Keeping it in
   one place avoids scattering globals across modules.
 */

import { makeDisconnectedDB } from '../model/dataService.js';

export const state = {
  mode: 'disconnected',          // 'disconnected' | 'connected'
  sbClient: null,                // the supabase-js client (when connected)
  db: makeDisconnectedDB(),      // active data backend (repository)
  REF: null,                     // cached reference data (statuses, methods, staff, ...)
  current: 'customers',          // active section id
  supabaseConfig: { url: '', key: '' },
};

// Section metadata drives the header 
export const SECTIONS = {
  customers: { eyebrow: 'Operations', title: 'Customers',
    sub: 'Learner-driver records. Add, edit and remove customers; balances are kept by the database triggers.' },
  lessons:   { eyebrow: 'Operations', title: 'Lessons',
    sub: 'Book lessons (validated against double-booking), record payments and cancel under the 24-hour rule.' },
  schedule:  { eyebrow: 'Views', title: 'Schedule & staff',
    sub: 'Read-only abstractions over the booking data — today, upcoming, active instructors and workload.' },
  reports:   { eyebrow: 'Views', title: 'Reports',
    sub: 'Aggregated insight, not table dumps: instructor revenue, cash-flow by method, debtors and fleet utilisation.' },
};