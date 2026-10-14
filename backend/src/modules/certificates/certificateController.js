
const certificateService = require("./certificateService");

const issueCertificate = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const certificate = await certificateService.issueCertificate(
      courseId,
      req.user
    );

    res.status(201).json({
      success: true,
      message: "Certificate issued successfully",
      data: { certificate },
    });
  } catch (error) {
    next(error);
  }
};

const getMyCertificates = async (req, res, next) => {
  try {
    const certificates = await certificateService.getMyCertificates(
      req.user._id
    );

    res.status(200).json({
      success: true,
      data: { certificates },
    });
  } catch (error) {
    next(error);
  }
};

const verifyCertificate = async (req, res, next) => {
  try {
    const certificate = await certificateService.verifyCertificate(
      req.params.certificateNumber
    );

    res.status(200).json({
      success: true,
      data: { certificate },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  issueCertificate,
  getMyCertificates,
  verifyCertificate,
};
