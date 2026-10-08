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

    const user = await registerUser(result.data);

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
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

module.exports = {
  register,
  login,
};