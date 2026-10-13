
const mongoose = require("mongoose");

const lectureBookmarkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lectureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
      required: true,
    },
  },
  { timestamps: true }
);

lectureBookmarkSchema.index(
  { userId: 1, lectureId: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "LectureBookmark",
  lectureBookmarkSchema
);
