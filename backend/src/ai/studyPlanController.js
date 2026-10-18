
const { getStudyPlan } = require("./studyPlanService");

const createStudyPlan = async (req, res, next) => {
  try {
    const { courseId, days = 7 } = req.body;

    if (!courseId) {
      return res.status(400).json({
        message: "courseId is required",
      });
    }

    const result = await getStudyPlan(courseId, req.user, days);

    return res.status(200).json({
      message: "Study plan generated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createStudyPlan };
