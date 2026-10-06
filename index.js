const express = require("express");
const cors = require("cors");
const { download } = require("@satorufx/mediadownloader");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;


// ========================================
// HOME
// ========================================

app.get("/", (req, res) => {
  res.json({
    status: true,
    name: "Rakib TikTok Download API",
    version: "3.0.0",
    message: "TikTok Downloader API 🚀",

    endpoints: {
      download: "/api/tiktok?url=TikTok_URL",
      ping: "/ping"
    }
  });
});


// ========================================
// PING
// ========================================

app.get("/ping", (req, res) => {
  res.json({
    status: true,
    message: "pong",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});


// ========================================
// TIKTOK DOWNLOAD
// ========================================

app.get("/api/tiktok", async (req, res) => {

  const { url } = req.query;

  // ========================================
  // URL CHECK
  // ========================================

  if (!url) {
    return res.status(400).json({
      status: false,
      message: "TikTok URL is required"
    });
  }

  if (!/^https?:\/\/(?:www\.|m\.|vt\.|vm\.)?tiktok\.com\//i.test(url)) {
    return res.status(400).json({
      status: false,
      message: "Invalid TikTok URL"
    });
  }

  console.log("");
  console.log("========================================");
  console.log("🎵 TIKTOK REQUEST");
  console.log("========================================");
  console.log("🔗 URL:", url);

  try {

    // ========================================
    // DOWNLOAD INFO
    // ========================================

    const result = await download(url);

    console.log(
      "📦 Downloader Result:",
      JSON.stringify(result).slice(0, 1500)
    );

    if (!result?.ok) {
      return res.status(500).json({
        status: false,
        message:
          result?.error ||
          result?.message ||
          "TikTok download failed",

        result: result || null
      });
    }

    // ========================================
    // MEDIA
    // ========================================

    const media = Array.isArray(result.media)
      ? result.media
      : [];

    const hd =
      media.find(
        item =>
          item.type === "video" &&
          item.quality === "hd_no_watermark"
      )?.url ||
      result.video ||
      null;

    const sd =
      media.find(
        item =>
          item.type === "video" &&
          item.quality === "no_watermark"
      )?.url ||
      null;

    const watermark =
      media.find(
        item =>
          item.type === "video" &&
          item.quality === "watermark"
      )?.url ||
      null;

    // ========================================
    // CHECK VIDEO
    // ========================================

    if (!hd && !sd && !watermark) {
      return res.status(500).json({
        status: false,
        message: "TikTok video URL not found",
        result: result
      });
    }

    // ========================================
    // RESPONSE
    // ========================================

    return res.json({

      status: true,

      author: {
        nickname:
          result.author ||
          "Unknown",

        avatar:
          result.thumbnail ||
          null
      },

      description:
        result.title &&
        !result.title.startsWith("Unknown tiktok aweme ID")
          ? result.title
          : "TikTok Video",

      video: {
        hd: hd,
        sd: sd,
        watermark: watermark
      },

      audio:
        result.audio ||
        media.find(
          item => item.type === "audio"
        )?.url ||
        null,

      type: "video",

      videoQuality:
        result.videoQuality ||
        "hd_no_watermark"

    });

  } catch (error) {

    console.error(
      "❌ TikTok Downloader Error:",
      error
    );

    return res.status(500).json({

      status: false,

      message:
        "TikTok download failed",

      error:
        error.message || "Unknown error"

    });

  }

});


// ========================================
// 404
// ========================================

app.use((req, res) => {

  res.status(404).json({

    status: false,

    message: "Endpoint not found",

    path: req.originalUrl

  });

});


// ========================================
// START SERVER
// ========================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log("");
    console.log("========================================");
    console.log("🚀 RAKIB TIKTOK DOWNLOAD API");
    console.log("========================================");
    console.log(`📡 Port  : ${PORT}`);
    console.log(`🌐 Local : http://localhost:${PORT}`);
    console.log(`❤️ Ping  : http://localhost:${PORT}/ping`);
    console.log("========================================");
    console.log("");

  }
);
