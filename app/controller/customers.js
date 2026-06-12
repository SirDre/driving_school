/* 
   controller/customers.js — customer CRUD + payments.
   Fetches via the model, renders via the view, wires the row actions and
   the form, and writes back through the model.
 */

import { state } from '../core/state.js';
import { $, toast, openModal, closeModal } from '../core/dom.js';
import { customersView } from '../view/sections.js';
import { customerFormHTML, paymentFormHTML, deleteCustomerHTML } from '../view/forms.js';
import { wireAddressPicker, readAddressFields, addressHasInput } from '../view/components.js';
import { refresh } from './router.js';

export async function mountCustomers() {

    $('headAction').innerHTML = `<button class="btn" id="newCust">+ New customer</button>`;
    $('newCust').onclick = () => openCustomerForm();
    
    const rows = await state.db.listCustomers();
    const v = $('view');
    
    v.innerHTML = customersView(rows);
    
    v.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openCustomerForm(rows.find(r => r.customer_id == b.dataset.edit)));
    v.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmDeleteCustomer(rows.find(r => r.customer_id == b.dataset.del)));
    v.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => openPaymentForm(rows.find(r => r.customer_id == b.dataset.pay)));
}

async function openCustomerForm(c) {
    const isEdit = !!c;
    let allAddr = [];
    try {
        allAddr = await state.db.listAddresses();
    } catch (e) { /* suggestions optional */ }
    
    let cur = null; if (isEdit && c.addr) { 
        

    }

    openModal(customerFormHTML(c, cur || {}, isEdit));
    wireAddressPicker('c', allAddr);
    $('cancel').onclick = closeModal;

    $('save').onclick = async () => {


    };
}

function openPaymentForm(c) {
    openModal(paymentFormHTML(c));
    $('cancel').onclick = closeModal;
    $('save').onclick = async () => {

    };
}

function confirmDeleteCustomer(c) {
    openModal(deleteCustomerHTML(c));
    const inp = $('confirmName'), del = $('del');
    $('cancel').onclick = closeModal;
    inp.oninput = () => {
        const ok = 1;
    };

    inp.focus();
    del.onclick = async () => {

    };
}