
const service = require("./contentService");
const {
  moduleSchema,
  updateModuleSchema,
  lectureSchema,
  updateLectureSchema,
} = require("./contentValidation");

const sendError = (res, result) =>
  res.status(400).json({
    success: false,
    message: "Validation failed",
    errors: result.error.issues,
  });

const createModule = async (req, res, next) => {
  try {
    const result = moduleSchema.safeParse(req.body);
    if (!result.success) return sendError(res, result);

    const module = await service.createModule(
      req.params.courseId,
      result.data,
      req.user
    );

    return res.status(201).json({
      success: true,
      data: { module },
    });
  } catch (error) {
    next(error);
  }
};

const updateModule = async (req, res, next) => {
  try {
    const result = updateModuleSchema.safeParse(req.body);
    if (!result.success) return sendError(res, result);

    const module = await service.updateModule(
      req.params.moduleId,
      result.data,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Module updated successfully",
      data: { module },
    });
  } catch (error) {
    next(error);
  }
};

const deleteModule = async (req, res, next) => {
  try {
    await service.deleteModule(req.params.moduleId, req.user);
    return res.status(200).json({
      success: true,
      message: "Module deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

const listModules = async (req, res, next) => {
  try {
    const modules = await service.listModules(req.params.courseId, req.user);
    return res.status(200).json({
      success: true,
      data: { modules },
    });
  } catch (error) {
    next(error);
  }
};

const createLecture = async (req, res, next) => {
  try {
    const result = lectureSchema.safeParse(req.body);
    if (!result.success) return sendError(res, result);

    const lecture = await service.createLecture(
      req.params.moduleId,
      result.data,
      req.user
    );

    return res.status(201).json({
      success: true,
      data: { lecture },
    });
  } catch (error) {
    next(error);
  }
};

const updateLecture = async (req, res, next) => {
  try {
    const result = updateLectureSchema.safeParse(req.body);
    if (!result.success) return sendError(res, result);

    const lecture = await service.updateLecture(
      req.params.lectureId,
      result.data,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Lecture updated successfully",
      data: { lecture },
    });
  } catch (error) {
    next(error);
  }
};

const deleteLecture = async (req, res, next) => {
  try {
    await service.deleteLecture(req.params.lectureId, req.user);
    return res.status(200).json({
      success: true,
      message: "Lecture deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

const listLectures = async (req, res, next) => {
  try {
    const lectures = await service.listLectures(req.params.moduleId);
    return res.status(200).json({
      success: true,
      data: { lectures },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createModule,
  updateModule,
  deleteModule,
  listModules,
  createLecture,
  updateLecture,
  deleteLecture,
  listLectures,
};
