const fs = require("fs");

function parseNetscapeCookies(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const cookies = [];

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;

    const parts = line.split("\t");
    if (parts.length < 7) continue;

    const [domain, , path, secure, , name, value] = parts;

    if (!name) continue;

    cookies.push({
      domain,
      path: path || "/",
      secure: secure === "TRUE",
      name,
      value
    });
  }

  return cookies;
}

function getCookieFile() {
  return process.env.TIKTOK_COOKIE_FILE || "./tiktok-cookie.txt";
}

function getCookies() {
  return parseNetscapeCookies(getCookieFile());
}

module.exports = {
  getCookies,
  getCookieFile
};
