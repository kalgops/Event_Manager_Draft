// middleware/auth.js
// -------------------------------------------
// Used to protect /organiser/* routes.
// -------------------------------------------

exports.ensureAdmin = (req, res, next) => {
  if (req.session?.organiserId) return next();
  // not logged-in: bounce to /login with ?next=...
  const nextUrl = encodeURIComponent(req.originalUrl);
  return res.redirect(`/login?next=${nextUrl}`);
};
