exports.ensureAdmin = (req, res, next) => {
  if (req.session?.organiserId) return next();
  res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
};
