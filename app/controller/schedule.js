/* 
   controller/schedule.js — the Schedule & staff section.
   Renders the read-only schedule/workload views, and (for ADMIN/STAFF)
   the instructor management table with add/edit/delete.
 */

import { state } from '../core/state.js';
import { $, toast } from '../core/dom.js';
import { scheduleView } from '../view/sections.js';
import { refresh } from './router.js';

export async function mountSchedule() {

    // Fetch all necessary data for the schedule and staff views.   
    const today = await state.db.listToday();
    const upcoming = await state.db.listUpcoming();
    const instr = await state.db.listInstructors();
    const work = await state.db.listWorkload();
    const staffRows = await state.db.listStaff();
    const canManage = false; // staff CRUD moved to controller/staff.js
    const v = $('view');

    // Render the schedule view (staff management is now a separate section).
    v.innerHTML = scheduleView({ today, upcoming, instr, work, staffRows, canManage });


}
