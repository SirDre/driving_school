/* 
   controller/schedule.js — the Schedule & staff section.
   Renders the read-only schedule/workload views, and (for ADMIN/STAFF)
   the instructor management table with add/edit/delete.
 */

import { state } from '../core/state.js';
import { $, toast, openModal, closeModal } from '../core/dom.js';
import { scheduleView } from '../view/sections.js';
import { staffFormHTML, deleteStaffHTML } from '../view/forms.js';
import { wireAddressPicker, readAddressFields, addressHasInput } from '../view/components.js';
import { canManageOperations } from '../model/session.js';
import { refresh } from './router.js';

export async function mountSchedule() {
    const canManage = canManageOperations(); 
 
    
    // fetch sequentially
    const today = await state.db.listToday();
    const upcoming = await state.db.listUpcoming();
    const instr = await state.db.listInstructors();
    const work = await state.db.listWorkload();
    const staffRows = await state.db.listStaff();

    const v = $('view');  

    if (canManage) {
        $('headAction').innerHTML = `<button class="btn" id="newStaff">+ Add instructor</button>`;
        $('newStaff').onclick = () => openStaffForm();
    } else {
        $('headAction').innerHTML = '';
    }

    v.innerHTML = scheduleView({ today, upcoming, instr, work, staffRows, canManage });

    if (canManage) {
        v.querySelectorAll('[data-staff-edit]').forEach(b => b.onclick = () => openStaffForm(staffRows.find(r => r.staff_id == b.dataset.staffEdit)));
        v.querySelectorAll('[data-staff-del]').forEach(b => b.onclick = () => confirmDeleteStaff(staffRows.find(r => r.staff_id == b.dataset.staffDel)));
    }
}

async function openStaffForm(row) {
    const isEdit = !!row;
    
    let allAddr = [];
    let cur = null; 
    
    if (isEdit && row?.staff_address_id) {
    
    
        try {
            cur = await state.db.getAddress(row.staff_address_id);
        } catch (e) { /* ignore */ }
    }


    try {
        allAddr = await state.db.listAddresses();
    } catch (e) { /*  optional */ }



    openModal(staffFormHTML(row, cur || {}, isEdit));
    wireAddressPicker('s', allAddr);

    $('cancel').onclick = closeModal;

    $('save').onclick = async () => {


    };

}

function confirmDeleteStaff(row) {
    openModal(deleteStaffHTML(row));
    $('cancel').onclick = closeModal;
    $('del').onclick = async () => {

    };
}