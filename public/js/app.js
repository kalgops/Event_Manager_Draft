// public/js/app.js - Enhanced with GSAP animations and improvements
document.addEventListener('DOMContentLoaded', () => {
  // Initialize GSAP
  gsap.registerPlugin(ScrollTrigger);

  // Theme handling
  const theme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);

  // Whirlwind loader for page transitions
  const loader = document.createElement('div');
  loader.className = 'whirlwind-loader';
  loader.innerHTML = '<div class="whirlwind"></div>';
  document.body.appendChild(loader);

  // Show loader on page navigation
  let navigating = false;
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.href && !link.href.includes('#') && !link.target && !navigating) {
      e.preventDefault();
      navigating = true;
      
      // Animate out current content
      gsap.to('.page-transition', {
        opacity: 0,
        y: -20,
        duration: 0.3,
        stagger: 0.05,
        ease: 'power2.in',
        onComplete: () => {
          loader.classList.add('active');
          setTimeout(() => {
            window.location.href = link.href;
          }, 300);
        }
      });
    }
  });

  // Page entry animations
  gsap.from('.card', {
    opacity: 0,
    y: 30,
    duration: 0.6,
    stagger: 0.1,
    ease: 'power3.out',
    delay: 0.2
  });

  gsap.from('.stat-card', {
    opacity: 0,
    scale: 0.9,
    duration: 0.5,
    stagger: 0.08,
    ease: 'back.out(1.7)',
    delay: 0.3
  });

  // Event handlers
  document.addEventListener('click', async (e) => {
    // Create new event
    if (e.target.matches('#create-event')) {
      e.preventDefault();
      const btn = e.target;
      
      // Animate button
      gsap.to(btn, {
        scale: 0.95,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut'
      });
      
      btn.disabled = true;
      btn.textContent = 'Creating...';
      
      try {
        const res = await axios.post('/organiser/events/new');
        if (res.data.success) {
          // Success animation
          gsap.to(btn, {
            backgroundColor: '#10b981',
            duration: 0.3,
            onComplete: () => {
              window.location.href = `/organiser/events/${res.data.id}/edit`;
            }
          });
        }
      } catch (err) {
        console.error('Error creating event:', err);
        showNotification('Failed to create event', 'error');
        btn.disabled = false;
        btn.textContent = 'Create New Event';
      }
    }
    
    // Publish event
    if (e.target.matches('.publish-btn')) {
      e.preventDefault();
      const btn = e.target;
      const id = btn.dataset.id;
      
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Publishing...';
      
      try {
        const res = await axios.post(`/organiser/events/${id}/publish`);
        if (res.data.success) {
          // Animate the card
          const card = btn.closest('.card, li');
          gsap.to(card, {
            scale: 1.02,
            duration: 0.2,
            yoyo: true,
            repeat: 1,
            ease: 'power2.inOut',
            onComplete: () => {
              btn.textContent = 'Published!';
              btn.classList.add('bg-green-500');
              setTimeout(() => window.location.reload(), 1000);
            }
          });
        }
      } catch (err) {
        console.error('Error publishing event:', err);
        showNotification('Failed to publish event', 'error');
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
    
    // Delete event
    if (e.target.matches('.delete-btn')) {
      e.preventDefault();
      const btn = e.target;
      const id = btn.dataset.id;
      
      if (!confirm('Delete this event forever? This action cannot be undone.')) {
        return;
      }
      
      btn.disabled = true;
      btn.textContent = 'Deleting...';
      
      try {
        const res = await axios.delete(`/organiser/events/${id}`);
        if (res.data.success) {
          const item = btn.closest('.card, li');
          
          // Animate deletion
          gsap.to(item, {
            scale: 0.8,
            opacity: 0,
            rotation: 5,
            duration: 0.4,
            ease: 'power2.in',
            onComplete: () => {
              item.remove();
              showNotification('Event deleted successfully', 'success');
            }
          });
        }
      } catch (err) {
        console.error('Error deleting event:', err);
        showNotification('Failed to delete event', 'error');
        btn.disabled = false;
        btn.textContent = 'Delete';
      }
    }
    
    // Toggle organiser active status (admin)
    if (e.target.matches('.toggle-organiser-btn')) {
      const btn = e.target;
      const id = btn.dataset.id;
      
      try {
        const res = await axios.post(`/admin/organisers/${id}/toggle`);
        if (res.data.success) {
          btn.textContent = res.data.is_active ? 'Deactivate' : 'Activate';
          btn.classList.toggle('btn-danger');
          btn.classList.toggle('btn-secondary');
          showNotification('Organiser status updated', 'success');
        }
      } catch (err) {
        console.error('Error toggling organiser:', err);
        showNotification('Failed to update status', 'error');
      }
    }
  });

  // Theme toggle with animation
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', async () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      
      // Animate theme change
      gsap.to('body', {
        opacity: 0.8,
        duration: 0.2,
        onComplete: async () => {
          document.documentElement.setAttribute('data-theme', newTheme);
          localStorage.setItem('theme', newTheme);
          
          try {
            await axios.post('/toggle-theme');
          } catch (err) {
            console.error('Error saving theme preference:', err);
          }
          
          gsap.to('body', {
            opacity: 1,
            duration: 0.2
          });
        }
      });
    });
  }

  // Initialize charts if present
  initializeCharts();

  // Form enhancements
  document.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('focus', () => {
      gsap.to(input, {
        scale: 1.02,
        duration: 0.2,
        ease: 'power2.out'
      });
    });
    
    input.addEventListener('blur', () => {
      gsap.to(input, {
        scale: 1,
        duration: 0.2,
        ease: 'power2.out'
      });
    });
  });

  // Ticket selection enhancement
  document.querySelectorAll('.ticket-option').forEach(option => {
    option.addEventListener('click', () => {
      option.classList.toggle('selected');
      const input = option.querySelector('input[type="number"]');
      if (input) {
        input.focus();
      }
    });
  });

  // Payment form formatting
  const cardNumberInput = document.querySelector('#cardNumber');
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\s/g, '');
      let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
      e.target.value = formattedValue;
    });
  }

  const expiryInput = document.querySelector('#cardExpiry');
  if (expiryInput) {
    expiryInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2, 4);
      }
      e.target.value = value;
    });
  }

  // Scroll animations
  gsap.utils.toArray('.animate-on-scroll').forEach(element => {
    gsap.from(element, {
      scrollTrigger: {
        trigger: element,
        start: 'top 80%',
        end: 'bottom 20%',
        toggleActions: 'play none none reverse'
      },
      opacity: 0,
      y: 50,
      duration: 0.8,
      ease: 'power3.out'
    });
  });
});

// Notification system
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `flash-message flash-${type} fixed top-4 right-4 max-w-md z-50`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  gsap.from(notification, {
    x: 100,
    opacity: 0,
    duration: 0.3,
    ease: 'power2.out'
  });
  
  setTimeout(() => {
    gsap.to(notification, {
      x: 100,
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => notification.remove()
    });
  }, 3000);
}

// Initialize charts
function initializeCharts() {
  // Booking chart (pie)
  const bookingChartEl = document.getElementById('bookingChart');
  if (bookingChartEl && window.bookingChartData) {
    const ctx = bookingChartEl.getContext('2d');
    new Chart(ctx, {
      type: 'pie',
      data: window.bookingChartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: getComputedStyle(document.documentElement)
                .getPropertyValue('--text-primary')
            }
          }
        },
        animation: {
          animateRotate: true,
          animateScale: true
        }
      }
    });
  }

  // Revenue chart (line)
  const revenueChartEl = document.getElementById('revenueChart');
  if (revenueChartEl && window.revenueChartData) {
    const ctx = revenueChartEl.getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: window.revenueChartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: getComputedStyle(document.documentElement)
                .getPropertyValue('--text-secondary')
            }
          },
          x: {
            ticks: {
              color: getComputedStyle(document.documentElement)
                .getPropertyValue('--text-secondary')
            }
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeOutQuart'
        }
      }
    });
  }

  // Analytics bar chart
  const analyticsChartEl = document.getElementById('analyticsChart');
  if (analyticsChartEl && window.analyticsChartData) {
    const ctx = analyticsChartEl.getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: window.analyticsChartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: getComputedStyle(document.documentElement)
                .getPropertyValue('--text-primary')
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            stacked: true,
            ticks: {
              color: getComputedStyle(document.documentElement)
                .getPropertyValue('--text-secondary')
            }
          },
          x: {
            stacked: true,
            ticks: {
              color: getComputedStyle(document.documentElement)
                .getPropertyValue('--text-secondary')
            }
          }
        }
      }
    });
  }
}

// Payment processing
async function processPayment(formData) {
  const paymentBtn = document.querySelector('#payment-submit');
  const originalText = paymentBtn.textContent;
  
  paymentBtn.disabled = true;
  paymentBtn.textContent = 'Processing...';
  
  // Show processing animation
  gsap.to('.payment-form', {
    opacity: 0.6,
    scale: 0.98,
    duration: 0.3
  });
  
  try {
    const response = await axios.post('/payment/process', formData);
    
    if (response.data.success) {
      // Success animation
      gsap.to('.payment-form', {
        opacity: 0,
        scale: 0.9,
        duration: 0.4,
        ease: 'power2.in',
        onComplete: () => {
          window.location.href = `/payment/success/${formData.bookingId}`;
        }
      });
    } else {
      throw new Error(response.data.error || 'Payment failed');
    }
  } catch (error) {
    gsap.to('.payment-form', {
      opacity: 1,
      scale: 1,
      duration: 0.3
    });
    
    showNotification(error.response?.data?.error || 'Payment failed. Please try again.', 'error');
    paymentBtn.disabled = false;
    paymentBtn.textContent = originalText;
  }
}