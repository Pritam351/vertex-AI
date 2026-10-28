const mongoose = require("mongoose");
const Course = require("../courses/courseModel");
const User = require("../users/userModel");

const getPendingCourses = async (req, res, next) => {
  try {
    const courses = await Course.find({ status: "pending" })
      .sort({ createdAt: 1 })
      .populate("instructorId", "fullName email");

    res.status(200).json({
      success: true,
      data: { courses },
    });
  } catch (error) {
    next(error);
  }
};

const reviewCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { decision } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
    }

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Decision must be approved or rejected",
      });
    }

    const course = await Course.findById(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (course.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "Only pending courses can be reviewed",
      });
    }

    course.status = decision;
    await course.save();

    return res.status(200).json({
      success: true,
      message: `Course ${decision} successfully`,
      data: { course },
    });
  } catch (error) {
    next(error);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const { search, role, status } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const query = {};

    // Filter by search query (name or email)
    if (search && search.trim()) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(sanitized, "i");
      query.$or = [{ fullName: searchRegex }, { email: searchRegex }];
    }

    // Filter by role
    if (role && role !== "all") {
      query.role = role.toLowerCase();
    }

    // Filter by account status
    if (status && status !== "all") {
      if (status === "active" || status === "true") {
        query.isActive = true;
      } else if (status === "suspended" || status === "inactive" || status === "false") {
        query.isActive = false;
      }
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-passwordHash")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    // Aggregate overall statistics for the admin dashboard/management
    const [totalAll, studentCount, instructorCount, adminCount, activeCount, suspendedCount] =
      await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ role: "student" }),
        User.countDocuments({ role: "instructor" }),
        User.countDocuments({ role: "admin" }),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ isActive: false }),
      ]);

    return res.status(200).json({
      success: true,
      data: {
        users,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        stats: {
          total: totalAll,
          students: studentCount,
          instructors: instructorCount,
          admins: adminCount,
          active: activeCount,
          suspended: suspendedCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    let { isActive, status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (typeof isActive !== "boolean") {
      if (status === "suspended" || status === "inactive") {
        isActive = false;
      } else if (status === "active") {
        isActive = true;
      } else {
        return res.status(400).json({
          success: false,
          message: "Please provide isActive (boolean) or status ('active' or 'suspended')",
        });
      }
    }

    const user = await User.findById(id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Safety guard: prevent admin from suspending their own active account
    if (req.user && req.user._id.toString() === user._id.toString() && !isActive) {
      return res.status(400).json({
        success: false,
        message: "You cannot suspend your own admin account",
      });
    }

    user.isActive = isActive;
    await user.save();

    const actionText = isActive ? "reactivated" : "suspended";

    return res.status(200).json({
      success: true,
      message: `User ${user.fullName} has been ${actionText} successfully`,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPendingCourses,
  reviewCourse,
  getAllUsers,
  updateUserStatus,
};
