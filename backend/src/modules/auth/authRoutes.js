const express = require("express");
const { register, 
        login,
        getMe,
    } = require("./authController");

const authMiddleware = require("../../middleware/authMiddleware");
const { authLimiter } = require("../../middleware/rateLimitMiddleware");

const router = express.Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", authMiddleware, getMe);

module.exports = router;
