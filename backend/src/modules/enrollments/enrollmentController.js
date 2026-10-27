
const service = require("./enrollmentService");
const { progressSchema } = require("./enrollmentValidation");

const enroll = async (req, res, next) => {
  try {
    const enrollment = await service.enrollInCourse(
      req.params.id,
      req.user._id
    );

    return res.status(201).json({
      success: true,
      message: "Enrolled successfully",
      data: { enrollment },
    });
  } catch (error) {
    next(error);
  }
};

const getMyEnrollments = async (req, res, next) => {
  try {
    const enrollments = await service.getMyEnrollments(req.user._id);

    return res.status(200).json({
      success: true,
      data: { enrollments },
    });
  } catch (error) {
    next(error);
  }
};

const updateProgress = async (req, res, next) => {
  try {
    const result = progressSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.issues,
      });
    }

    const progress = await service.updateLectureProgress(
      req.params.id,
      req.user._id,
      result.data
    );

    return res.status(200).json({
      success: true,
      message: "Progress updated",
      data: { progress },
    });
  } catch (error) {
    next(error);
  }
};

const getCourseEnrollments = async (req, res, next) => {
  try {
    const enrollments = await service.getCourseEnrollments(
      req.params.id,
      req.user
    );

    return res.status(200).json({
      success: true,
      data: { enrollments },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  enroll,
  getMyEnrollments,
  updateProgress,
  getCourseEnrollments,
};
