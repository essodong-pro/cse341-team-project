export const loadSessionUser = (req, res, next) => {
  req.user = req.session.user || null;
  res.locals.user = req.user;
  return next();
};

const isLoggedIn = (req) => {
  return Boolean(req.user);
};

const hasRole = (req, role) => {
  return req.user?.role === role;
};

export const requireApiLogin = (req, res, next) => {
  if (!isLoggedIn(req)) {
    return res
      .status(401)
      .json({ message: "Authentication required" });
  }

   return next();
};

export const requirePageLogin = (req, res, next) => {
  if (!isLoggedIn(req)) {
    return res.redirect("/login");
  }

  return next();
};

export const requireApiRole = (role) => {
  return (req, res, next) => {
    if (!isLoggedIn(req)) {
      return res
        .status(401)
        .json({ message: "Authentication required" });
    }

    if (!hasRole(req, role)) {
      return res
        .status(403)
        .json({ message: "Forbidden" });
    }

    return next();
  };
};

export const requirePageRole = (role) => {
  return (req, res, next) => {

    if (!isLoggedIn(req)) {
      return res.redirect("/login");
    }

    if (!hasRole(req, role)) {
      return res.status(403).render("errors/403", {
        title: "Forbidden",
        error: "Access denied"
      });
    }

    return next();
  };
};