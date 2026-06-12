/* 
   controller/reports.js — the Reports section.
   Pulls the four datasets in parallel and hands them to the report view,
   which computes the display-derived figures (top earner, debtors, etc.).
 */

import { state } from '../core/state.js';
import { $ } from '../core/dom.js';
import { reportsView } from '../view/sections.js';

export async function mountReports() {
   
    // fetch sequentially
    const work = await state.db.listWorkload();
    const bal = await state.db.listBalances();
    const monthly = await state.db.listMonthly();
    const vehicle = await state.db.listVehicleUtil(); 

    $('view').innerHTML = reportsView({ work, bal, monthly, vehicle });
}