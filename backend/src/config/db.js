const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.warn("Initial MongoDB connection warning:", error.message);
    console.warn("If connection failed due to IP whitelist, please whitelist your IP (or 0.0.0.0/0) on MongoDB Atlas.");
  }
};

mongoose.connection.on("connected", () => {
  console.log("Mongoose connected to MongoDB cluster");
});

mongoose.connection.on("error", (err) => {
  console.warn("Mongoose connection warning:", err.message);
});

module.exports = connectDB;
