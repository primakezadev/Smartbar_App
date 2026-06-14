const authorize = (allowedRoles) => {
  return (req, res, next) => {
    // 1. Ensure user was authenticated first
    if (!req.user || !req.user.role) {
      return res.status(403).json({ success: false, message: "Unauthorized: No role found." });
    }

    // 2. Check if the user's role is in the 'allowedRoles' array
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not have the required permissions." });
    }

    next();
  };
};

module.exports = authorize;