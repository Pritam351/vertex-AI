const {
  createAnnouncement,
  getCourseAnnouncements,
  getInstructorAnnouncements,
  deleteAnnouncement,
  togglePinAnnouncement,
} = require("./announcementService");

const createCourseAnnouncement = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const result = await createAnnouncement(courseId, req.user, req.body);

    return res.status(201).json({
      success: true,
      message: `Announcement published successfully and ${result.notifiedCount || 0} student(s) notified`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const listCourseAnnouncements = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const data = await getCourseAnnouncements(courseId, req.user);

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

const listInstructorAnnouncements = async (req, res, next) => {
  try {
    const data = await getInstructorAnnouncements(req.user);

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

const removeAnnouncement = async (req, res, next) => {
  try {
    const { announcementId } = req.params;
    const data = await deleteAnnouncement(announcementId, req.user);

    return res.status(200).json({
      success: true,
      message: "Announcement deleted successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

const pinAnnouncement = async (req, res, next) => {
  try {
    const { announcementId } = req.params;
    const data = await togglePinAnnouncement(announcementId, req.user);

    return res.status(200).json({
      success: true,
      message: `Announcement ${data.isPinned ? "pinned" : "unpinned"} successfully`,
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCourseAnnouncement,
  listCourseAnnouncements,
  listInstructorAnnouncements,
  removeAnnouncement,
  pinAnnouncement,
};

