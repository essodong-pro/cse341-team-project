/**
 * Allows the request when the signed-in user is an admin or is acting on
 * their own record (req.params.id). Use after requireApiLogin.
 */
export const requireApiSelfOrAdmin = (req, res, next) => {
  const isAdmin = req.user.role === "admin";
  // Mongo accepts uppercase hex ids; req.user.id is always lowercase.
  const isSelf = req.user.id === String(req.params.id).toLowerCase();

  if (!isAdmin && !isSelf) {
    return res.status(403).json({ message: "Forbidden" });
  }

  return next();
};
