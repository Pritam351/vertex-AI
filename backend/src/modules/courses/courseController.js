const {
  courseSchema,
  updateCourseSchema,
} = require("./courseValidation");

const courseService = require("./courseService");

const createCourse = async (req, res, next) => {
  try {
    const result = courseSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.issues,
      });
    }

    const course = await courseService.createCourse(result.data, req.user);

    return res.status(201).json({
      success: true,
      message: "Course created and submitted for approval",
      data: { course },
    });
  } catch (error) {
    next(error);
  }
};

const listCourses = async (req, res, next) => {
  try {
    const data = await courseService.listCourses(req.query);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};


const listMyCourses = async (req, res, next) => {
  try {
    const courses = await courseService.listInstructorCourses(req.user);

    return res.status(200).json({
      success: true,
      data: { courses },
    });
  } catch (error) {
    next(error);
  }
};


const getCourseById = async (req, res, next) => {
  try {
    const course = await courseService.getCourseById(req.params.id);

    return res.status(200).json({
      success: true,
      data: { course },
    });
  } catch (error) {
    next(error);
  }
};

const updateCourse = async (req, res, next) => {
  try {
    const result = updateCourseSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.issues,
      });
    }

    const course = await courseService.updateCourse(
      req.params.id,
      result.data,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: { course },
    });
  } catch (error) {
    next(error);
  }
};

const deleteCourse = async (req, res, next) => {
  try {
    await courseService.deleteCourse(req.params.id, req.user);

    return res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCourse,
  listCourses,
  listMyCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
};