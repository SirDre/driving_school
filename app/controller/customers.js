/* 
   controller/customers.js — customer CRUD + payments.
   Fetches via the model, renders via the view, wires the row actions and
   the form, and writes back through the model.
 */

import { state } from '../core/state.js';
import { $, toast, openModal, closeModal } from '../core/dom.js';
import { isValidEmail, isValidPhone } from '../core/format.js';
import { customersView } from '../view/sections.js';
import { customerFormHTML, paymentFormHTML, deleteCustomerHTML } from '../view/forms.js';
import { wireAddressPicker, readAddressFields, addressHasInput } from '../view/components.js';
import { refresh } from './router.js';

// Shows the customer management table with add/edit/delete and payment recording.
export async function mountCustomers() {
    $('headAction').innerHTML = `<button class="btn" id="newCust">+ New customer</button>`;
    $('newCust').onclick = () => openCustomerForm();

    // Fetch all customers and render the view. 
    const rows = await state.db.listCustomers();
    const v = $('view');

    // Set up click handlers for edit, delete, and payment buttons in the customer table.
    v.innerHTML = customersView(rows);
    v.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openCustomerForm(rows.find(r => r.customer_id == b.dataset.edit)));
    v.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmDeleteCustomer(rows.find(r => r.customer_id == b.dataset.del)));
    v.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => openPaymentForm(rows.find(r => r.customer_id == b.dataset.pay)));
}

// Shows the add/edit form for a customer.  
async function openCustomerForm(c) {
    const isEdit = !!c;
    let allAddr = [];
    let cur = null;

    try {
        // Fetch all addresses for the address picker 
        allAddr = await state.db.listAddresses();

        // If editing and the customer has an address, fetch it to pre-fill the form.
        if (isEdit && c.addr) {
            cur = await state.db.getAddress(c.addr);
        }
    } catch (e) { /* suggestions optional */ }

    // Render the form modal with the customer data (if editing) and the list of all addresses for the picker.
    openModal(customerFormHTML(c, cur || {}, isEdit));
    wireAddressPicker('c', allAddr);

    // Set up the cancel button to close the modal.
    $('cancel').onclick = closeModal;

    // Set up the save button to validate input, save through the model, and refresh the view.
    $('save').onclick = async () => {
        const r = {
            first: $('f_first').value.trim(), last: $('f_last').value.trim(), dob: $('f_dob').value, since: $('f_since').value,
            status: $('f_status').value, email: $('f_email').value.trim(), cell: $('f_cell').value.trim(),
        };

        // Basic validation: ensure required fields are filled. More complex validation (e.g. email format) could be added here or in the model.
        if (!r.first || !r.last || !r.dob || !r.since) {
            toast('Name, date of birth and start date are required.', true);
            return;
        }

        // Basic email validation: either blank or must be a valid email format.
        if (r.email && !isValidEmail(r.email)) {
            toast('Enter a valid e-mail address, or leave it blank.', true);
            return;
        }

        // Basic phone validation: either blank or must be a valid phone number format.
        if (r.cell && !isValidPhone(r.cell)) {
            toast('Enter a valid mobile number, or leave it blank.', true);
            return;
        }

        // If any address fields are filled.
        const addr = readAddressFields('c');

        // If any address input is present, validate required address fields and resolve or create the address, then set staffAddressId in the payload.
        if (addressHasInput(addr)) {
            if (!addr.line_1_number_building || !addr.city || !addr.zip_postcode) {
                toast('For an address, building (line 1), city and postcode are required.', true); return;
            }
            try { r.addr = await state.db.resolveAddress(addr); }
            catch (e) { toast('Could not save the address: ' + e.message, true); return; }
        } else { r.addr = null; }

        // Save through the model, then refresh the view. Error handling will show a toast if something goes wrong.
        try {
            if (isEdit) { await state.db.updateCustomer(c.customer_id, r); toast('Customer saved.'); }
            else { await state.db.addCustomer(r); toast('Customer added.'); }
            closeModal(); state.REF = null; refresh();
        } catch (e) {
            toast(e.message, true);
        }
    };
}

// Shows the payment recording form for a customer.
function openPaymentForm(c) {
    openModal(paymentFormHTML(c));

    // Set up the cancel button to close the modal.
    $('cancel').onclick = closeModal;

    // Set up the save button to validate input, save through the model, and refresh the view.
    $('save').onclick = async () => {
        const amt = parseFloat($('p_amt').value);
        // Basic validation: amount must be a number greater than zero.
        if (!(amt > 0)) {
            toast('Enter an amount greater than zero.', true);
            return;
        }
        // Save the payment through the model, then refresh the view. Error handling will show a toast if something goes wrong.
        try {
            await state.db.recordPayment({ cust: c.customer_id, method: $('p_method').value, amt, notes: $('p_note').value.trim() });
            toast('Payment recorded.'); closeModal(); refresh();
        } catch (e) {
            toast(e.message, true);
        }
    };
}

// Shows a confirmation modal for deleting a customer. Requires typing the customer's name to confirm.
function confirmDeleteCustomer(c) {
    openModal(deleteCustomerHTML(c));
    const inp = $('confirmName'), del = $('del');

    // Cancel just closes the modal.
    $('cancel').onclick = closeModal;

    // Enable the delete button only when the input matches the customer's name, to prevent accidental deletions.
    inp.oninput = () => {
        const ok = inp.value.trim() === c.customer_name;
        del.disabled = !ok;
        del.style.opacity = ok ? 1 : 0.5;
    };
    inp.focus();

    // Delete calls the model to delete the customer, then shows a toast and refreshes the view.
    del.onclick = async () => {

        // Double-check the name matches before deleting.
        try {
            await state.db.deleteCustomer(c.customer_id);
            toast('Customer deleted.'); closeModal(); refresh();
        } catch (e) {
            closeModal();
            toast(e.message, true);
        }
    };
}