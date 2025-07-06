/**
 * Simple session-based auth guards
 * (adjust the session keys to match your own logic)
 */
function ensureAuthenticated (req, res, next) {
  if (req.session?.userId) return next();
  // Not logged-in – store the url and send to login
  req.session.returnTo = req.originalUrl;
  return res.redirect('/login');
}

function ensureAdmin (req, res, next) {
  // example: an `is_admin` flag set at login time
  if (req.session?.isAdmin) return next();
  // Logged-in but not an admin
  return res.status(403).render('403');
}

module.exports = {
  ensureAuthenticated,
  ensureAdmin,
};
