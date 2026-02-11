const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ===================
// Middlewares
// ===================
app.use(cors());
app.use(express.json());

// ===================
// 🔐 API KEY PROTECTION
// Only protect /api routes
// ===================
app.use("/api", (req, res, next) => {
  const apiKey =
    req.headers["x-api-key"] || req.query.apikey;

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      status: false,
      message: "Unauthorized! Invalid API Key"
    });
  }

  next();
});

// ===================
// Routes
// ===================
const tikRoutes = require("./routes/tikRoutes");
app.use("/api", tikRoutes);

// ===================
// Home Route (No key needed)
// ===================
app.get("/", (req, res) => {
  res.json({
    status: true,
    message: "Rakib Tik API is running 🚀"
  });
});

// ===================
// 404 Handler
// ===================
app.use((req, res) => {
  res.status(404).json({
    status: false,
    message: "Route not found"
  });
});

// ===================
// Start Server
// ===================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
