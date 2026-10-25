const User = require("../modules/users/userModel");
const { verifyToken } = require("../utils/jwt");

const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return next();
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select("-passwordHash");

    if (user && user.isActive) {
      req.user = user;
    }

    next();
  } catch {
    next();
  }
};

module.exports = optionalAuthMiddleware;
