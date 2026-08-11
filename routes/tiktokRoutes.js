const express = require("express");
const controller = require("../controllers/tiktokController");

const router = express.Router();

router.get("/search", controller.search);
router.get("/video", controller.video);

module.exports = router;
