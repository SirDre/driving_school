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

  const rows = await state.db.listLessons();
  const v = $('view');

  v.innerHTML = lessonsView(rows);
  
  v.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => confirmCancelLesson(+b.dataset.cancel));
  v.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmDeleteLesson(rows.find(r => r.lesson_id == b.dataset.del)));
}

function openLessonForm() {
  openModal(lessonFormHTML());
  $('cancel').onclick = closeModal;
  $('save').onclick = async () => {
 
  };
}

function confirmDeleteLesson(l) {
  openModal(deleteLessonHTML(l));

  $('cancel').onclick = closeModal;
  $('del').onclick = async () => {
 
  };
}

function confirmCancelLesson(id) {
  openModal(cancelLessonHTML());
  $('cancel').onclick = closeModal;
  $('go').onclick = async () => {
 
  };
}