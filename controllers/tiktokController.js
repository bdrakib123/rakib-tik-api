const tiktokService = require("../services/tiktokService");

function checkApiKey(req, res) {
  const expected = process.env.API_KEY;

  if (!expected) {
    res.status(500).json({
      status: false,
      message: "API_KEY is not configured"
    });
    return false;
  }

  const supplied = req.query.apikey || req.headers["x-api-key"];

  if (!supplied || supplied !== expected) {
    res.status(401).json({
      status: false,
      message: "Invalid API key"
    });
    return false;
  }

  return true;
}

function makePublicUrl(req, route, params) {
  const base =
    String(process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "") ||
    `${req.protocol}://${req.get("host")}`;

  const qs = new URLSearchParams(params);
  qs.set("apikey", req.query.apikey || req.headers["x-api-key"] || "");

  return `${base}${route}?${qs.toString()}`;
}

async function search(req, res) {
  if (!checkApiKey(req, res)) return;

  const query = String(req.query.q || "").trim();

  if (!query) {
    return res.status(400).json({
      status: false,
      message: "Query is required"
    });
  }

  const limit = Math.min(
    Math.max(Number(req.query.limit || process.env.SEARCH_LIMIT || 10), 1),
    20
  );

  try {
    const results = await tiktokService.searchTikTok(query, limit);

    const data = results.map(item => ({
      title: item.title,
      author: item.author,
      url: item.url,
      thumbnail: item.thumbnail,
      no_watermark: makePublicUrl(
        req,
        "/api/tiktok/video",
        { url: item.url }
      )
    }));

    return res.json({
      status: true,
      data
    });
  } catch (error) {
    console.error("[SEARCH]", error);
    return res.status(502).json({
      status: false,
      message: error.message || "TikTok search failed"
    });
  }
}

async function video(req, res) {
  if (!checkApiKey(req, res)) return;

  const url = String(req.query.url || "").trim();

  if (!/^https?:\/\/(www\.)?tiktok\.com\//i.test(url)) {
    return res.status(400).json({
      status: false,
      message: "A valid TikTok URL is required"
    });
  }

  try {
    const result = await tiktokService.getNoWatermark(url);

    if (!result.no_watermark) {
      return res.status(404).json({
        status: false,
        message: "No downloadable video format found"
      });
    }

    // Proxy the video so the bot does not need TikTok's expiring direct URL.
    const response = await tiktokService.streamVideo(
      result.no_watermark,
      res
    );

    if (response) {
      return;
    }

    return res.status(502).json({
      status: false,
      message: "Video stream failed"
    });
  } catch (error) {
    console.error("[VIDEO]", error);
    return res.status(502).json({
      status: false,
      message: error.message || "Download failed"
    });
  }
}

module.exports = {
  search,
  video
};
