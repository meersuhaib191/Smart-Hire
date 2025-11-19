import multer from "multer";
import path from "path";

// Storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/resumes/");
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// Only allow PDF, DOC, DOCX
function fileFilter(req, file, cb) {
  const allowed = ["application/pdf",
                   "application/msword",
                   "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only PDF, DOC, DOCX allowed."), false);
  }
}

const upload = multer({ storage, fileFilter });

export default upload;
