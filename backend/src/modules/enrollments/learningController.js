
const service = require("./learningService");
const { noteSchema } = require("./learningValidation");

const saveNote = async (req, res, next) => {
  try {
    const result = noteSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.issues,
      });
    }

    const note = await service.saveNote(
      req.params.lectureId,
      req.user._id,
      result.data.content
    );

    return res.status(200).json({
      success: true,
      message: "Note saved successfully",
      data: { note },
    });
  } catch (error) {
    next(error);
  }
};

const getNote = async (req, res, next) => {
  try {
    const note = await service.getNote(
      req.params.lectureId,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      data: { note },
    });
  } catch (error) {
    next(error);
  }
};

const addBookmark = async (req, res, next) => {
  try {
    const bookmark = await service.addBookmark(
      req.params.lectureId,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: "Lecture bookmarked successfully",
      data: { bookmark },
    });
  } catch (error) {
    next(error);
  }
};

const removeBookmark = async (req, res, next) => {
  try {
    const result = await service.removeBookmark(
      req.params.lectureId,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: "Bookmark removed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getMyBookmarks = async (req, res, next) => {
  try {
    const bookmarks = await service.getMyBookmarks(req.user._id);

    return res.status(200).json({
      success: true,
      data: { bookmarks },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  saveNote,
  getNote,
  addBookmark,
  removeBookmark,
  getMyBookmarks,
};
