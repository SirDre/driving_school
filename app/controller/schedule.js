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

    // Fetch all necessary data for the schedule and staff views.   
    const today = await state.db.listToday();
    const upcoming = await state.db.listUpcoming();
    const instr = await state.db.listInstructors();
    const work = await state.db.listWorkload();
    const staffRows = await state.db.listStaff();
    const canManage = canManageOperations();
    const v = $('view');

    // If the user has permissions, show the "Add instructor" button and set up its click handler. Otherwise, ensure no action buttons are shown.
    if (canManage) {
        $('headAction').innerHTML = `<button class="btn" id="newStaff">+ Add instructor</button>`;
        $('newStaff').onclick = () => openStaffForm();
    } else {
        $('headAction').innerHTML = '';
    }

    // If the user can manage, set up click handlers for edit and delete buttons in the staff table. Otherwise, these buttons won't be rendered at all.
    if (canManage) {
        v.querySelectorAll('[data-staff-edit]').forEach(b => b.onclick = () => openStaffForm(staffRows.find(r => r.staff_id == b.dataset.staffEdit)));
        v.querySelectorAll('[data-staff-del]').forEach(b => b.onclick = () => confirmDeleteStaff(staffRows.find(r => r.staff_id == b.dataset.staffDel)));
    }

    // Render the schedule view with all the fetched data and the canManage flag to conditionally show management features.
    v.innerHTML = scheduleView({ today, upcoming, instr, work, staffRows, canManage });


}

async function openStaffForm(row) {
    const isEdit = !!row;
    let allAddr = [];
    let cur = null;

    // Fetch all addresses for the address picker (optional, but nice to have).
    try {
        allAddr = await state.db.listAddresses();
    } catch (e) {
        toast('Could not load the addresses: ' + e.message, true);
        return;
    }

    // If editing and the instructor has an address, fetch it to pre-fill the form.
    if (isEdit && row?.staff_address_id) {
        cur = await state.db.getAddress(row.staff_address_id);

    }

    // Render the form modal with the staff data (if editing) and the list of all addresses for the picker.
    openModal(staffFormHTML(row, cur || {}, isEdit));
    wireAddressPicker('s', allAddr);

    // Cancel just closes the modal.
    $('cancel').onclick = closeModal;

    // Save validates the form, then either adds or updates the instructor through the model.
    $('save').onclick = async () => {

        // Gather form data into a payload object. Basic validation for required fields.
        const payload = {
            staffAddressId: null, status: $('s_status').value, nickname: $('s_nick').value.trim(),
            first: $('s_first').value.trim(), middle: $('s_middle').value.trim(), last: $('s_last').value.trim(),
            dob: $('s_dob').value || null, joined: $('s_joined').value, left: $('s_left').value || null, notes: $('s_notes').value.trim(),
        };

        // Basic validation: first name, last name and joined date are required.
        if (!payload.first || !payload.last || !payload.joined) {
            toast('First name, last name and joined date are required.', true);
            return;
        }


        // If any address fields are filled, validate that the required address fields are present, then resolve or create the address and set staffAddressId.
        try {

            const addr = readAddressFields('s');

            // If any address input is present 
            if (addressHasInput(addr)) {

                if (!addr.line_1_number_building || !addr.city || !addr.zip_postcode) {
                    toast('For an address, building (line 1), city and postcode are required.', true);
                    return;
                }

                // Try to resolve the address to an ID. 
                try {
                    payload.staffAddressId = await state.db.resolveAddress(addr);
                } catch (e) {
                    toast('Could not save the address: ' + e.message, true);
                    return;
                }
            }

            // Save the instructor. If editing, update the existing record; if adding, create a new one.
            if (isEdit) {
                await state.db.updateStaff(row.staff_id, payload);
                toast('Instructor saved.');
            } else {
                await state.db.addStaff(payload);
                toast('Instructor added.');
            }

            closeModal();
            state.REF = null;
            refresh();

        } catch (e) {
            toast(e.message, true); // Show any errors
        }
    };


}

// Shows a confirmation modal for deleting an instructor. 
function confirmDeleteStaff(row) {
    openModal(deleteStaffHTML(row));

    //  Cancel just closes the modal
    $('cancel').onclick = closeModal;

    // Delete calls the model to delete the instructor, then shows a toast and refreshes the view.
    $('del').onclick = async () => {
        try {
            await state.db.deleteStaff(row.staff_id);
            toast('Instructor deleted.');
            closeModal();
            state.REF = null;
            refresh();
        } catch (e) {
            toast(e.message, true);
        }
    };
}