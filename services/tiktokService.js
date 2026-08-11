const axios = require("axios");
const { chromium } = require("playwright");
const { TikTokClient } = require("@ssut/tiktok-api");
const { getCookies } = require("./cookieService");

let browserPromise = null;

function getClient() {
  return new TikTokClient({
    region: process.env.TIKTOK_REGION || "US"
  });
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true
    }).catch(err => {
      browserPromise = null;
      throw err;
    });
  }

  return browserPromise;
}

function normalizeAuthorFromUrl(url) {
  const match = url.match(/tiktok\.com\/@([^/]+)/i);
  return match ? decodeURIComponent(match[1]) : "Unknown";
}

async function searchTikTok(query, limit = 10) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/138.0.0.0 Safari/537.36"
  });

  try {
    const cookies = getCookies();

    if (cookies.length) {
      await context.addCookies(
        cookies.map(c => ({
          ...c,
          sameSite: "Lax"
        }))
      );
    }

    const page = await context.newPage();

    const searchUrl =
      `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`;

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForTimeout(2500);

    const results = await page.evaluate((max) => {
      const anchors = Array.from(
        document.querySelectorAll('a[href*="/video/"]')
      );

      const seen = new Set();
      const out = [];

      for (const a of anchors) {
        const href = a.href;
        if (!href || seen.has(href)) continue;

        const match = href.match(
          /https?:\/\/www\.tiktok\.com\/@([^/]+)\/video\/([0-9]+)/i
        );

        if (!match) continue;

        seen.add(href);

        const root =
          a.closest("article") ||
          a.closest('[data-e2e="search_video-item"]') ||
          a.parentElement;

        const text = (root?.innerText || a.innerText || "")
          .replace(/\s+/g, " ")
          .trim();

        const img = root?.querySelector("img");

        out.push({
          url: href.split("?")[0],
          author: match[1],
          title: text.slice(0, 300) || "TikTok Video",
          thumbnail: img?.src || img?.getAttribute("data-src") || null
        });

        if (out.length >= max) break;
      }

      return out;
    }, limit);

    if (!results.length) {
      const bodyText = await page.locator("body").innerText().catch(() => "");
      if (/captcha|verify|challenge|robot/i.test(bodyText)) {
        throw new Error(
          "TikTok returned a verification/challenge page"
        );
      }

      throw new Error("No TikTok search results found");
    }

    return results;
  } finally {
    await context.close().catch(() => {});
  }
}

async function getNoWatermark(url) {
  const client = getClient();

  const result = await client.downloadVideo(url);

  if (
    !result ||
    result.status !== "success" ||
    result.result?.type !== "video"
  ) {
    throw new Error("TikTok video information unavailable");
  }

  const formats = result.result.video?.formats || [];

  const candidates = formats
    .filter(f => f?.url)
    .sort((a, b) => {
      const aw = a.has_watermark ? 1 : 0;
      const bw = b.has_watermark ? 1 : 0;

      if (aw !== bw) return aw - bw;

      const aq = Number(a.height || 0) * Number(a.width || 0);
      const bq = Number(b.height || 0) * Number(b.width || 0);

      return bq - aq;
    });

  const best = candidates.find(f => !f.has_watermark) || candidates[0];

  if (!best?.url) {
    throw new Error("No downloadable video URL found");
  }

  return {
    title: result.result.video.title || "TikTok Video",
    author: result.result.video.author?.unique_id || "Unknown",
    thumbnail: result.result.video.cover || null,
    no_watermark: best.url,
    format: {
      resolution: best.resolution || null,
      width: best.width || null,
      height: best.height || null,
      has_watermark: Boolean(best.has_watermark)
    }
  };
}

async function streamVideo(url, res) {
  const response = await axios.get(url, {
    responseType: "stream",
    timeout: 120000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://www.tiktok.com/"
    }
  });

  const contentType =
    response.headers["content-type"] || "video/mp4";

  res.status(200);
  res.setHeader("Content-Type", contentType);

  if (response.headers["content-length"]) {
    res.setHeader(
      "Content-Length",
      response.headers["content-length"]
    );
  }

  response.data.pipe(res);

  return true;
}

process.on("SIGTERM", async () => {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      await browser.close();
    } catch {}
  }

  process.exit(0);
});

module.exports = {
  searchTikTok,
  getNoWatermark,
  streamVideo
};
