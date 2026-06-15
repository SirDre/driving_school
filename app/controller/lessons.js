/* 
   controller/lessons.js — lesson booking, cancellation and deletion.
*/

import { state } from '../core/state.js';
import { $, toast, openModal, closeModal } from '../core/dom.js';
import { lessonsView } from '../view/sections.js';
import { lessonFormHTML, deleteLessonHTML, cancelLessonHTML } from '../view/forms.js';
import { refresh } from './router.js';

export async function mountLessons() {
  $('headAction').innerHTML = `<button class="btn" id="newLesson">+ Book lesson</button>`;
  $('newLesson').onclick = () => openLessonForm();
  
  // get all lessons and render the view. Set up click handlers for cancel and delete buttons in the lesson table.
  const rows = await state.db.listLessons();
  
  // set up click handlers for cancel and delete buttons in the lesson table. 
  const v = $('view');
  v.innerHTML = lessonsView(rows);
  v.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openLessonForm(rows.find(r => r.lesson_id == b.dataset.edit)));
  v.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => confirmCancelLesson(+b.dataset.cancel));
  v.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmDeleteLesson(rows.find(r => r.lesson_id == b.dataset.del)));
}

// Shows the form to book a new lesson. Validates input, calls the model to save, and refreshes the view on success.
async function openLessonForm(lesson) {
  const isEdit = !!lesson;
  let current = null;

  if (isEdit) {
    try {
      current = await state.db.getLesson(lesson.lesson_id);
    } catch (e) {
      toast(e.message, true);
      return;
    }
  }

  openModal(lessonFormHTML(current, isEdit));

  // Set up the cancel button to close the modal.
  $('cancel').onclick = closeModal;

  // set up the save button to validate input, save through the model, and refresh the view.
  $('save').onclick = async () => {

    // Get input values into a lesson object. 
    const p = {
      cust: $('b_cust').value, staff: $('b_staff').value, veh: $('b_veh').value,
      date: $('b_date').value, time: $('b_time').value, price: $('b_price').value, notes: $('b_notes').value.trim(),
      status_code: $('b_status').value,
    };

    // Basic validation 
    if (!p.date || !p.time) {
      toast('Date and time are required.', true);

      return;
    }

    try {
      // save the lesson through the model 
      if (isEdit) {
        await state.db.updateLesson(current.lesson_id, p);
        toast('Lesson updated.');
      } else {
        const newId = await state.db.bookLesson(p);
        if (p.status_code && p.status_code !== 'BOOK') {
          await state.db.updateLesson(newId, p);
        }
        toast('Lesson booked.');
      }
    } catch (e) {
      toast(e.message, true);
      return;
    }
    closeModal();
    refresh();
  };
}

function confirmDeleteLesson(l) {
  openModal(deleteLessonHTML(l));

  // set up the cancel button to close the modal.
  $('cancel').onclick = closeModal;

  // set up the delete button to call the model to delete the lesson, then refresh the view.
  $('del').onclick = async () => {

    // call the model to delete the lesson
    await state.db.deleteLesson(l.lesson_id);

    // show success message
    toast('Lesson deleted.');

    closeModal();
    refresh();
  };
}

function confirmCancelLesson(id) {
  openModal(cancelLessonHTML());

  // set up the cancel button to close the modal.
  $('cancel').onclick = closeModal;

  // set up the cancel button to call the model to cancel the lesson, then refresh the view.
  $('go').onclick = async () => {

    // call the model to cancel the lesson and get the result to determine the toast message
    const r = await state.db.cancelLesson(id);

    // show success message based on the result
    toast(r === 'late' ? 'Cancelled late — kept billable as No show.' : 'Lesson cancelled.');

    closeModal();
    refresh();
  };
}