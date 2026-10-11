const mongoose = require("mongoose");
const Course = require("../courses/courseModel");

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

module.exports = {
  getPendingCourses,
  reviewCourse,
};
