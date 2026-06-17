/*
   controller/staff.js — staff (instructor) CRUD moved out of schedule.js.
*/

import { state } from '../core/state.js';
import { $, toast, openModal, closeModal } from '../core/dom.js';
import { staffFormHTML, deleteStaffHTML } from '../view/forms.js';
import { wireAddressPicker, readAddressFields, addressHasInput } from '../view/components.js';
import { refresh } from './router.js';

// Shows the staff management table with add/edit/delete.
export async function mountStaff() {
  $('headAction').innerHTML = `<button class="btn" id="newStaff">+ Add instructor</button>`;
  $('newStaff').onclick = () => openStaffForm();

  const staffRows = await state.db.listStaff();
  const v = $('view');
  v.innerHTML = '';

  // Render using the staff view from sections.js (kept simple: controller handles DOM wiring)
  // We'll reuse the schedule view's table fragment via view function if available.
  v.innerHTML = (await import('../view/sections.js')).staffView(staffRows);

  v.querySelectorAll('[data-staff-edit]').forEach(b => b.onclick = () => openStaffForm(staffRows.find(r => r.staff_id == b.dataset.staffEdit)));
  v.querySelectorAll('[data-staff-del]').forEach(b => b.onclick = () => confirmDeleteStaff(staffRows.find(r => r.staff_id == b.dataset.staffDel)));
}

async function openStaffForm(row) {
  const isEdit = !!row;
  let allAddr = [];
  let cur = null;

  try { allAddr = await state.db.listAddresses(); } catch (e) { toast('Could not load the addresses: ' + e.message, true); return; }

  if (isEdit && row?.staff_address_id) cur = await state.db.getAddress(row.staff_address_id);

  openModal(staffFormHTML(row, cur || {}, isEdit));
  wireAddressPicker('s', allAddr);

  $('cancel').onclick = closeModal;

  $('save').onclick = async () => {
    const payload = {
      staffAddressId: null, status: $('s_status').value, nickname: $('s_nick').value.trim(),
      first: $('s_first').value.trim(), middle: $('s_middle').value.trim(), last: $('s_last').value.trim(),
      dob: $('s_dob').value || null, joined: $('s_joined').value, left: $('s_left').value || null, notes: $('s_notes').value.trim(),
    };

    if (!payload.first || !payload.last || !payload.joined) { toast('First name, last name and joined date are required.', true); return; }

    try {
      const addr = readAddressFields('s');
      if (addressHasInput(addr)) {
        if (!addr.line_1_number_building || !addr.city || !addr.zip_postcode) { toast('For an address, building (line 1), city and postcode are required.', true); return; }
        try { payload.staffAddressId = await state.db.resolveAddress(addr); } catch (e) { toast('Could not save the address: ' + e.message, true); return; }
      }

      if (isEdit) { await state.db.updateStaff(row.staff_id, payload); toast('Instructor saved.'); }
      else { await state.db.addStaff(payload); toast('Instructor added.'); }

      closeModal(); state.REF = null; refresh();
    } catch (e) { toast(e.message, true); }
  };
}

function confirmDeleteStaff(row) {
  openModal(deleteStaffHTML(row));
  $('cancel').onclick = closeModal;
  $('del').onclick = async () => {
    try { await state.db.deleteStaff(row.staff_id); toast('Instructor deleted.'); closeModal(); state.REF = null; refresh(); }
    catch (e) { toast(e.message, true); }
  };
}
/* 
   controller/staff.js — staff CRUD.
   Fetches via the model, renders via the view, wires the row actions and
   the form, and writes back through the model.
 */