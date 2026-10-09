const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { spawn } = require("child_process");
const util = require("util");

const execFileAsync = util.promisify(execFile);

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const SEARCH_PORT = Number(process.env.SEARCH_PORT || 8001);
const PYTHON_BIN =
  process.env.PYTHON_BIN ||
  path.join(__dirname, ".search-venv", "bin", "python");

let searchProcess = null;

function startSearchWorker() {
  if (process.env.DISABLE_TIKTOK_SEARCH === "1") {
    console.log("TikTok Search Worker: DISABLED");
    return;
  }

  if (!fs.existsSync(PYTHON_BIN)) {
    console.warn(`TikTok Search Worker: Python not found: ${PYTHON_BIN}`);
    return;
  }

  searchProcess = spawn(
    PYTHON_BIN,
    [
      "-m",
      "uvicorn",
      "search_server:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(SEARCH_PORT)
    ],
    {
      cwd: __dirname,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  searchProcess.stdout.on("data", data => {
    process.stdout.write(`[SEARCH] ${data}`);
  });

  searchProcess.stderr.on("data", data => {
    process.stderr.write(`[SEARCH] ${data}`);
  });

  searchProcess.on("error", err => {
    console.error("TikTok Search Worker error:", err.message);
  });

  searchProcess.on("exit", (code, signal) => {
    console.log(
      `TikTok Search Worker stopped. code=${code} signal=${signal}`
    );
    searchProcess = null;
  });

  console.log(
    `TikTok Search Worker starting on 127.0.0.1:${SEARCH_PORT}`
  );
}

function stopSearchWorker() {
  if (searchProcess) {
    searchProcess.kill("SIGTERM");
    searchProcess = null;
  }
}


const MCP_DIR = path.join(__dirname, "tiktok-downloader-mcp");
const MCP_CLI = path.join(MCP_DIR, "dist", "index.js");

const CACHE_DIR = path.join(os.tmpdir(), "rakib-tik-api-cache");

const CACHE_TTL = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 100 * 1024 * 1024;

fs.mkdirSync(CACHE_DIR, { recursive: true });

const cache = new Map();
const running = new Map();

/* ----------------------------- helpers ----------------------------- */

function jsonError(res, message, status = 400) {
  return res.status(status).json({
    status: false,
    message
  });
}

function hashUrl(url) {
  return crypto
    .createHash("sha256")
    .update(url)
    .digest("hex");
}

function validTikTokUrl(url) {
  try {
    const u = new URL(url);

    return (
      u.hostname.includes("tiktok.com") ||
      u.hostname.includes("vt.tiktok.com") ||
      u.hostname.includes("vm.tiktok.com")
    );
  } catch {
    return false;
  }
}

function cleanupCache() {
  const now = Date.now();

  for (const [key, item] of cache.entries()) {
    if (
      now - item.createdAt > CACHE_TTL ||
      !fs.existsSync(item.videoPath)
    ) {
      try {
        if (item.dir && fs.existsSync(item.dir)) {
          fs.rmSync(item.dir, {
            recursive: true,
            force: true
          });
        }
      } catch {}

      cache.delete(key);
    }
  }
}

function findVideoFile(dir) {
  let result = null;

  function walk(current) {
    if (result) return;

    let files;

    try {
      files = fs.readdirSync(current, {
        withFileTypes: true
      });
    } catch {
      return;
    }

    for (const entry of files) {
      const full = path.join(current, entry.name);

      if (entry.isDirectory()) {
        walk(full);
      } else if (
        entry.isFile() &&
        entry.name.toLowerCase().endsWith(".mp4")
      ) {
        result = full;
        return;
      }
    }
  }

  walk(dir);

  return result;
}

function findJsonFile(dir) {
  let result = null;

  function walk(current) {
    if (result) return;

    let files;

    try {
      files = fs.readdirSync(current, {
        withFileTypes: true
      });
    } catch {
      return;
    }

    for (const entry of files) {
      const full = path.join(current, entry.name);

      if (entry.isDirectory()) {
        walk(full);
      } else if (
        entry.isFile() &&
        entry.name === "post.json"
      ) {
        result = full;
        return;
      }
    }
  }

  walk(dir);

  return result;
}

function normalizePost(post) {
  if (!post || typeof post !== "object") {
    return {};
  }

  // tiktok-downloader-mcp structure:
  // {
  //   post_details: {...},
  //   raw_tiktok_data: {...}
  // }

  const details =
    post.post_details ||
    post.postDetails ||
    post;

  const raw =
    post.raw_tiktok_data ||
    post.rawTikTokData ||
    {};

  const author =
    details.author ||
    raw.author ||
    {};

  const stats =
    details.stats ||
    {};

  const rawStats = {
    views:
      stats.views ??
      raw.play_count ??
      0,

    likes:
      stats.likes ??
      raw.digg_count ??
      0,

    comments:
      stats.comments ??
      raw.comment_count ??
      0,

    shares:
      stats.shares ??
      raw.share_count ??
      0,

    favorites:
      stats.favorites ??
      raw.collect_count ??
      0,

    downloads:
      stats.downloads ??
      raw.download_count ??
      0,

    totalInteractions:
      stats.totalInteractions ??
      0,

    engagementRatePercent:
      stats.engagementRatePercent ??
      0
  };

  return {
    id:
      details.id ||
      raw.id ||
      null,

    author: {
      id:
        author.id ||
        null,

      uniqueId:
        author.uniqueId ||
        author.unique_id ||
        details.user ||
        "",

      nickname:
        author.nickname ||
        "",

      avatar:
        author.avatar ||
        "",

      profileUrl:
        author.profileUrl ||
        `https://www.tiktok.com/@${
          author.uniqueId ||
          author.unique_id ||
          details.user ||
          ""
        }`
    },

    description:
      details.title ||
      raw.title ||
      (Array.isArray(details.content_desc)
        ? details.content_desc.filter(Boolean).join(" ")
        : "") ||
      "",

    type:
      details.media_type ||
      "video",

    date:
      details.date ||
      null,

    timestamp:
      details.timestamp ||
      details.create_time ||
      raw.create_time ||
      null,

    duration:
      details.duration ||
      raw.duration ||
      0,

    stats: rawStats,

    cover:
      raw.cover ||
      "",

    music: details.music || {
      id:
        raw.music_info?.id ||
        null,

      title:
        raw.music_info?.title ||
        "",

      author:
        raw.music_info?.author ||
        "",

      playUrl:
        raw.music ||
        raw.music_info?.play ||
        ""
    },

    raw: post
  };
}

/* ------------------------- TikTok extractor ------------------------- */

async function extractTikTok(url) {
  const key = hashUrl(url);

  const cached = cache.get(key);

  if (
    cached &&
    Date.now() - cached.createdAt < CACHE_TTL &&
    fs.existsSync(cached.videoPath)
  ) {
    return cached;
  }

  if (running.has(key)) {
    return running.get(key);
  }

  const task = (async () => {
    const workDir = path.join(
      CACHE_DIR,
      `${key}-${Date.now()}`
    );

    fs.mkdirSync(workDir, {
      recursive: true
    });

    try {
      if (!fs.existsSync(MCP_CLI)) {
        throw new Error(
          "TikTok downloader is not built. Run: cd tiktok-downloader-mcp && npm run build"
        );
      }

      await execFileAsync(
        process.execPath,
        [
          MCP_CLI,
          url,
          "--out",
          workDir
        ],
        {
          cwd: MCP_DIR,
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024
        }
      );

      const videoPath = findVideoFile(workDir);
      const jsonPath = findJsonFile(workDir);

      if (!videoPath) {
        throw new Error(
          "TikTok video could not be extracted"
        );
      }

      const stat = fs.statSync(videoPath);

      if (stat.size > MAX_CACHE_SIZE) {
        throw new Error(
          "Video file is too large"
        );
      }

      let post = {};

      if (jsonPath) {
        try {
          post = JSON.parse(
            fs.readFileSync(jsonPath, "utf8")
          );
        } catch {}
      }

      const normalized = normalizePost(post);

      const item = {
        key,
        url,
        dir: workDir,
        videoPath,
        jsonPath,
        post: normalized,
        createdAt: Date.now(),
        size: stat.size
      };

      cache.set(key, item);

      return item;
    } catch (error) {
      try {
        fs.rmSync(workDir, {
          recursive: true,
          force: true
        });
      } catch {}

      throw error;
    } finally {
      running.delete(key);
    }
  })();

  running.set(key, task);

  return task;
}

/* ------------------------------- routes ------------------------------ */

app.get("/", (req, res) => {
  res.json({
    status: true,
    name: "RAKIB TIK API",
    version: "2.0.0",
    message: "TikTok API is running 🚀",
    endpoints: {
      info: "/",
      ping: "/ping",
      tiktok: "/api/tiktok?url=TikTok_URL",
      stream: "/api/tiktok/stream?url=TikTok_URL"
    }
  });
});

app.get("/ping", (req, res) => {
  res.json({
    status: true,
    message: "pong",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/* ----------------------------- main API ----------------------------- */

app.get("/api/tiktok", async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return jsonError(
      res,
      "TikTok URL is required"
    );
  }

  if (!validTikTokUrl(url)) {
    return jsonError(
      res,
      "Invalid TikTok URL"
    );
  }

  try {
    const item = await extractTikTok(url);

    const post = item.post || {};

    const author = post.author || {};

    const streamUrl =
      `/api/tiktok/stream?url=${encodeURIComponent(url)}`;

    const base =
      `${req.protocol}://${req.get("host")}`;

    const mediaUrl = base + streamUrl;

    return res.json({
      status: true,

      author: {
        nickname:
          author.nickname ||
          author.unique_id ||
          author.username ||
          "",

        username:
          author.uniqueId ||
          author.unique_id ||
          post.user ||
          post.uniqueId ||
          post.unique_id ||
          "",

        avatar:
          author.avatar ||
          author.avatar_url ||
          author.avatarLarger ||
          ""
      },

      description:
        post.description || "",

      video: {
        hd: mediaUrl,
        sd: mediaUrl,
        watermark: mediaUrl
      },

      type:
        post.type || "video",

      id:
        post.id || null,

      stats:
        post.stats || {},

      cached: true,

      size:
        item.size
    });
  } catch (error) {
    console.error(
      "[TIKTOK ERROR]",
      error.message
    );

    return res.status(500).json({
      status: false,
      message: "TikTok video information unavailable",
      error: error.message
    });
  }
});

/* ----------------------------- stream API ---------------------------- */

app.get("/api/tiktok/stream", async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return jsonError(
      res,
      "TikTok URL is required"
    );
  }

  if (!validTikTokUrl(url)) {
    return jsonError(
      res,
      "Invalid TikTok URL"
    );
  }

  try {
    const item = await extractTikTok(url);

    if (!fs.existsSync(item.videoPath)) {
      cache.delete(item.key);

      return jsonError(
        res,
        "Cached video expired. Please try again.",
        404
      );
    }

    const stat = fs.statSync(item.videoPath);

    res.setHeader(
      "Content-Type",
      "video/mp4"
    );

    res.setHeader(
      "Content-Length",
      stat.size
    );

    res.setHeader(
      "Content-Disposition",
      'inline; filename="tiktok.mp4"'
    );

    res.setHeader(
      "Cache-Control",
      "public, max-age=300"
    );

    const stream =
      fs.createReadStream(item.videoPath);

    stream.on("error", (error) => {
      console.error(
        "[STREAM ERROR]",
        error.message
      );

      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    stream.pipe(res);
  } catch (error) {
    console.error(
      "[STREAM ERROR]",
      error.message
    );

    return res.status(500).json({
      status: false,
      message: "Unable to download TikTok video",
      error: error.message
    });
  }
});

/* ------------------------------ cleanup ------------------------------ */

setInterval(
  cleanupCache,
  5 * 60 * 1000
);

process.on("SIGINT", () => {
  console.log("Stopping RAKIB TIK API...");

  try {
    fs.rmSync(CACHE_DIR, {
      recursive: true,
      force: true
    });
  } catch {}

  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Stopping RAKIB TIK API...");

  try {
    fs.rmSync(CACHE_DIR, {
      recursive: true,
      force: true
    });
  } catch {}

  process.exit(0);
});

/* ------------------------------- server ------------------------------ */


app.post("/search", async (req, res) => {
  try {
    const response = await fetch(
      `http://127.0.0.1:${SEARCH_PORT}/search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(req.body)
      }
    );

    const text = await response.text();

    res.status(response.status);

    try {
      return res.json(JSON.parse(text));
    } catch {
      return res.send(text);
    }
  } catch (error) {
    console.error("Search proxy error:", error.message);

    return res.status(503).json({
      status: false,
      error: "TikTok search service unavailable"
    });
  }
});

startSearchWorker();


process.on("SIGINT", () => {
  stopSearchWorker();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopSearchWorker();
  process.exit(0);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`

         RAKIB TIK API v2.0.0        ║
#

 PORT    : ${PORT}
 STATUS  : ONLINE 🚀
 ENGINE  : tiktok-downloader-mcp
`);
});
