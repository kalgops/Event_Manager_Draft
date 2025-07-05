// public/js/transitions.js

document.addEventListener('DOMContentLoaded', () => {
  barba.init({
    sync: true,
    transitions: [
      {
        name: 'whirlwind',
        leave({ current }) {
          // spin out the old content
          return gsap.to(current.container, {
            duration: 0.6,
            rotation: 720,
            opacity: 0,
            ease: 'power1.in'
          });
        },
        enter({ next }) {
          // start new content spun backward and invisible
          gsap.set(next.container, { rotation: -720, opacity: 0 });
          // spin into place
          return gsap.to(next.container, {
            duration: 0.6,
            rotation: 0,
            opacity: 1,
            ease: 'power1.out'
          });
        }
      }
    ]
  });
});
