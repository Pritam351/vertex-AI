const mongoose = require("mongoose");
const Course = require("../courses/courseModel");
const User = require("../users/userModel");

const getDashboardStats = async (req, res, next) => {
  try {
    // Parallel course counts by status
    const [totalCourses, liveCourses, pendingCourses, rejectedCourses] = await Promise.all([
      Course.countDocuments({}),
      Course.countDocuments({ status: "approved" }),
      Course.countDocuments({ status: "pending" }),
      Course.countDocuments({ status: "rejected" }),
    ]);

    // Fetch live (approved) courses with instructor name + email
    const liveCoursesData = await Course.find({ status: "approved" })
      .sort({ updatedAt: -1 })
      .limit(50)
      .populate("instructorId", "fullName email")
      .select("title category difficulty thumbnailUrl createdAt instructorId");

    // User counts
    const [totalUsers, studentCount, instructorCount, adminCount] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "instructor" }),
      User.countDocuments({ role: "admin" }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        courses: {
          total: totalCourses,
          live: liveCourses,
          pending: pendingCourses,
          rejected: rejectedCourses,
          liveCoursesList: liveCoursesData,
        },
        users: {
          total: totalUsers,
          students: studentCount,
          instructors: instructorCount,
          admins: adminCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

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

const getPublishedCourses = async (req, res, next) => {
  try {
    const courses = await Course.find({ status: "approved" })
      .sort({ updatedAt: -1 })
      .populate("instructorId", "fullName email");

    res.status(200).json({
      success: true,
      data: { courses },
    });
  } catch (error) {
    next(error);
  }
};

const getArchivedCourses = async (req, res, next) => {
  try {
    const courses = await Course.find({ status: "archived" })
      .sort({ updatedAt: -1 })
      .populate("instructorId", "fullName email");

    res.status(200).json({
      success: true,
      data: { courses },
    });
  } catch (error) {
    next(error);
  }
};

const toggleCoursePublish = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // "publish" | "unpublish"

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
    }

    if (!["publish", "unpublish"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'publish' or 'unpublish'",
      });
    }

    const course = await Course.findById(id).populate("instructorId", "fullName email");
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (action === "publish") {
      if (course.status !== "archived") {
        return res.status(409).json({
          success: false,
          message: "Only archived courses can be published",
        });
      }
      course.status = "approved";
    } else {
      if (course.status !== "approved") {
        return res.status(409).json({
          success: false,
          message: "Only approved (live) courses can be unpublished",
        });
      }
      course.status = "archived";
    }

    await course.save();

    if (action === "publish") {
      try {
        const { createBulkNotifications } = require("../notifications/notificationService");
        const students = await User.find({ role: "student" }).select("_id").lean();
        if (students.length > 0) {
          await createBulkNotifications(
            students.map((s) => ({
              userId: s._id,
              type: "announcement",
              title: `Course Published: ${course.title}`,
              message: `Course "${course.title}" has been published and is now available in the catalog!`,
              link: "#/student/catalog",
            }))
          );
        }
      } catch (_) {}
    }

    return res.status(200).json({
      success: true,
      message: `Course "${course.title}" has been ${action === "publish" ? "published" : "unpublished"} successfully`,
      data: { course },
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

    if (decision === "approved") {
      try {
        const { createBulkNotifications, createNotification } = require("../notifications/notificationService");
        if (course.instructorId) {
          await createNotification({
            userId: course.instructorId,
            type: "announcement",
            title: `Course Approved: ${course.title}`,
            message: `Congratulations! Your course "${course.title}" has been approved and is now live.`,
            link: "#/instructor/courses",
          });
        }
        const students = await User.find({ role: "student" }).select("_id").lean();
        if (students.length > 0) {
          await createBulkNotifications(
            students.map((s) => ({
              userId: s._id,
              type: "announcement",
              title: `New Course: ${course.title}`,
              message: `A brand new course "${course.title}" is now available in the catalog!`,
              link: "#/student/catalog",
            }))
          );
        }
      } catch (_) {}
    }

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

const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const ALLOWED_ROLES = ["student", "instructor"];
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be one of: student, instructor",
      });
    }

    // Prevent admin from changing their own role
    if (req.user && req.user._id.toString() === id) {
      return res.status(403).json({
        success: false,
        message: "You cannot change your own role",
      });
    }

    const target = await User.findById(id).select("-passwordHash");
    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Protect the last active admin from being demoted
    if (target.role === "admin") {
      const activeAdminCount = await User.countDocuments({ role: "admin", isActive: true });
      if (activeAdminCount <= 1) {
        return res.status(409).json({
          success: false,
          message: "Cannot demote the last active admin account",
        });
      }
    }

    target.role = role;
    await target.save();

    return res.status(200).json({
      success: true,
      message: `${target.fullName}'s role has been updated to ${role}`,
      data: { user: target },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getPendingCourses,
  getPublishedCourses,
  getArchivedCourses,
  toggleCoursePublish,
  reviewCourse,
  getAllUsers,
  updateUserStatus,
  updateUserRole,
};
