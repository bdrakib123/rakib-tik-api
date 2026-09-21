const express = require("express");
const cors = require("cors");
const TikTokAPI = require("@tobyg74/tiktok-api-dl");

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
    version: "1.0.0",
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
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "TikTok URL is required"
      });
    }

    if (!/tiktok\.com/i.test(url)) {
      return res.status(400).json({
        status: false,
        message: "Invalid TikTok URL"
      });
    }

    console.log(`⬇️ TikTok Download: ${url}`);

    const response = await TikTokAPI.Downloader(url, {
      version: "v3"
    });

    if (
      !response ||
      response.status !== "success" ||
      !response.result
    ) {
      return res.status(500).json({
        status: false,
        message: "TikTok video information unavailable",
        result: response || null
      });
    }

    const data = response.result;

    return res.json({
      status: true,

      author: {
        nickname: data.author?.nickname || null,
        avatar: data.author?.avatar || null
      },

      description: data.desc || null,

      video: {
        hd: data.videoHD || null,
        sd: data.videoSD || null,
        watermark: data.videoWatermark || null
      },

      type: data.type || "video"
    });

  } catch (error) {
    console.error("DOWNLOAD ERROR:", error);

    return res.status(500).json({
      status: false,
      message: "TikTok download failed",
      error: error.message
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

app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("========================================");
  console.log("🚀 RAKIB TIKTOK DOWNLOAD API");
  console.log("========================================");
  console.log(`📡 Port  : ${PORT}`);
  console.log(`🌐 Local : http://localhost:${PORT}`);
  console.log(`❤️ Ping  : http://localhost:${PORT}/ping`);
  console.log("========================================");
  console.log("");
});
