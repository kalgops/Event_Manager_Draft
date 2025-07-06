/**
 * Keep unfinished ticket edits in localStorage so they re-appear
 * if the organiser refreshes or navigates away and back.
 */
(() => {
  const form = document.getElementById('edit-event');
  if (!form) return;                      // not on this page

  const eventId     = form.dataset.event;
  const storeKey    = `ticketDraft-${eventId}`;
  const ticketsWrap = document.getElementById('tickets');
  const rowTemplate = ticketsWrap.querySelector('.ticket-row').cloneNode(true);

  /* ───────────────── restore ───────────────── */
  const cached = localStorage.getItem(storeKey);
  if (cached) {
    try {
      const draft = JSON.parse(cached);
      ticketsWrap.innerHTML = '';
      draft.forEach(addRow);
    } catch { /* corrupt JSON ⇒ ignore */ }
  }

  /* ───────────────── live-save ───────────────── */
  ticketsWrap.addEventListener('input', throttle(saveDraft, 400));
  ticketsWrap.addEventListener('click', e => {
    if (e.target.classList.contains('remove-ticket')) saveDraft();
  });
  document.getElementById('add-ticket')
          .addEventListener('click', () => {
            addRow({}); saveDraft();
          });

  /* ───────────────── clear on submit ───────────────── */
  form.addEventListener('submit', () => localStorage.removeItem(storeKey));

  /* ───────────────── helpers ───────────────── */
  function addRow({ id = '', type = '', price = '', quantity = '' }) {
    const row = rowTemplate.cloneNode(true);
    row.dataset.id = id;
    row.querySelector('[name$="[type]"]').value     = type;
    row.querySelector('[name$="[price]"]').value    = price;
    row.querySelector('[name$="[quantity]"]').value = quantity;
    ticketsWrap.appendChild(row);
  }

  function saveDraft () {
    const rows = [...ticketsWrap.querySelectorAll('.ticket-row')].map(r => ({
      id:       r.dataset.id || '',
      type:     r.querySelector('[name$="[type]"]').value.trim(),
      price:    r.querySelector('[name$="[price]"]').value.trim(),
      quantity: r.querySelector('[name$="[quantity]"]').value.trim()
    }));
    localStorage.setItem(storeKey, JSON.stringify(rows));
  }

  function throttle (fn, ms) {
    let t; return (...a)=>!t&&(t=setTimeout(()=>{ fn(...a); t=0; },ms));
  }
})();
