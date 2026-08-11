require("dotenv").config();

const express = require("express");
const routes = require("./routes/tiktokRoutes");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    status: true,
    message: "Rakib Tik API is running 🚀",
    version: "2.0.0",
    private: true,
    endpoints: {
      health: "/health",
      search: "/api/tiktok/search?q=cat&apikey=YOUR_KEY",
      video: "/api/tiktok/video?url=VIDEO_URL&apikey=YOUR_KEY"
    }
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: true,
    service: "rakib-tik-api",
    uptime: process.uptime(),
    time: new Date().toISOString()
  });
});

app.use("/api/tiktok", routes);

app.use((req, res) => {
  res.status(404).json({
    status: false,
    message: "Endpoint not found"
  });
});

app.use((err, req, res, next) => {
  console.error("[SERVER ERROR]", err);
  res.status(500).json({
    status: false,
    message: "Internal server error"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Rakib Tik API listening on port ${PORT}`);
});
