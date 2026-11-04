const { registerSchema,
        loginSchema,
      } = require("./authValidation");

const { registerUser,
        loginUser,
      } = require("./authService");

const register = async (req, res, next) => {
  try {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    // registerUser now returns { token, user } so the client can open an
    // authenticated session immediately after registration.
    const { token, user } = await registerUser(result.data);

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        token,
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const resultData = await loginUser(result.data);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: resultData,
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          fullName: req.user.fullName,
          email: req.user.email,
          role: req.user.role,
          avatarUrl: req.user.avatarUrl,
          isActive: req.user.isActive,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
};