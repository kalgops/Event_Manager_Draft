/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './views/**/*.ejs',        // all EJS templates
    './public/js/**/*.js',     // any Alpine / custom JS that contains class names
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
