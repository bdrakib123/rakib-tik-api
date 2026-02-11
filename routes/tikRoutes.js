const express = require("express");
const router = express.Router();
const { downloadTik } = require("../controllers/tikController");

router.get("/tiktok", downloadTik);

module.exports = router;
