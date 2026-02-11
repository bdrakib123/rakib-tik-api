const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// 🔐 Protect only /api routes with API key
app.use("/api", (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      status: false,
      message: "Unauthorized! Invalid API Key"
    });
  }

  next();
});

// Routes
const tikRoutes = require("./routes/tikRoutes");
app.use("/api", tikRoutes);

// Home route (optional, no key required)
app.get("/", (req, res) => {
  res.json({
    status: true,
    message: "Rakib Tik API is running 🚀"
  });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
