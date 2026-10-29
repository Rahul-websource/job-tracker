const express = require("express");
const authenticateToken = require("../middleware/auth.middleware");

const {
  createInterview,
  getInterviews,
  getInterviewById,
  updateInterview,
  deleteInterview,
} = require("../controllers/interviews.controller");

const router = express.Router();

router.use(authenticateToken);

router.post("/", createInterview);
router.get("/", getInterviews);
router.get("/:id", getInterviewById);
router.patch("/:id", updateInterview);
router.delete("/:id", deleteInterview);

module.exports = router;
