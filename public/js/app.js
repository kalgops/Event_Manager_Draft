// public/js/app.js
document.addEventListener('DOMContentLoaded', () => {
  // Animate cards on load
  gsap.from('.card', {
    opacity: 0,
    y: 20,
    duration: 0.6,
    stagger: 0.1,
    ease: 'power2.out'
  });

  // Notifications
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `flash-message flash-${type} fixed top-4 right-4 bg-white border px-4 py-2 shadow rounded text-sm z-50`;
    notification.textContent = message;
    document.body.appendChild(notification);

    gsap.from(notification, { x: 100, opacity: 0, duration: 0.3 });
    setTimeout(() => {
      gsap.to(notification, {
        x: 100,
        opacity: 0,
        duration: 0.3,
        onComplete: () => notification.remove()
      });
    }, 3000);
  }

  // Button Actions
  document.addEventListener('click', async (e) => {
    const btn = e.target;

    // ─── Publish Event ─────────────────────────────
    if (btn.matches('.publish-btn')) {
      e.preventDefault();
      const id = btn.dataset.id;
      const originalText = btn.textContent;

      btn.disabled = true;
      btn.textContent = 'Publishing...';

      try {
        const res = await axios.post(`/organiser/events/${id}/publish`);
        if (res.data.success) {
          const card = btn.closest('.card');
          gsap.to(card, {
            scale: 1.05,
            duration: 0.2,
            yoyo: true,
            repeat: 1,
            ease: 'power2.inOut',
            onComplete: () => {
              btn.textContent = 'Published!';
              btn.classList.add('bg-green-500', 'text-white');
              setTimeout(() => window.location.reload(), 800);
            }
          });
        } else {
          throw new Error('Failed to publish');
        }
      } catch (err) {
        console.error('Publish Error:', err);
        showNotification('Failed to publish event', 'error');
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }

    // ─── Delete Event ─────────────────────────────
    if (btn.matches('.delete-btn')) {
      e.preventDefault();
      const id = btn.dataset.id;
      const originalText = btn.textContent;

      if (!confirm('Are you sure you want to delete this event?')) return;

      btn.disabled = true;
      btn.textContent = 'Deleting...';

      try {
        const res = await axios.delete(`/organiser/events/${id}`);
        if (res.data.success) {
          const card = btn.closest('.card');
          gsap.to(card, {
            opacity: 0,
            scale: 0.9,
            duration: 0.3,
            ease: 'back.in',
            onComplete: () => {
              card.remove();
              showNotification('Event deleted successfully', 'success');
            }
          });
        } else {
          throw new Error('Delete failed');
        }
      } catch (err) {
        console.error('Delete Error:', err);
        showNotification('Failed to delete event', 'error');
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  });

  // Theme toggle (optional)
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', async () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      try {
        await axios.post('/toggle-theme');
      } catch (err) {
        console.warn('Theme toggle failed:', err);
      }
    });
  }
});
