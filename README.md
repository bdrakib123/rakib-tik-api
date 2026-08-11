# 🔒 Rakib Tik API

Private TikTok search + video proxy API.

## Structure

```text
controllers/
routes/
services/
.env
tiktok-cookie.txt
index.js
package.json
```

## Features

- Private API key
- Netscape TikTok cookie support
- TikTok web search
- Video metadata
- No-watermark format selection when available
- Video proxy endpoint
- Health endpoint
- Render-friendly Express server
- Cookie file is excluded from Git

## Setup

```bash
npm install
npm run browser
cp .env.example .env
```

Set:

```env
PORT=3000
API_KEY=your-private-key
PUBLIC_BASE_URL=https://your-service.onrender.com
TIKTOK_REGION=US
TIKTOK_COOKIE_FILE=./tiktok-cookie.txt
SEARCH_LIMIT=10
```

Then put your own Netscape cookie export into:

```text
tiktok-cookie.txt
```

Do not commit that file.

## Run

```bash
npm start
```

## Test

```bash
curl "http://localhost:3000/health"

curl "http://localhost:3000/api/tiktok/search?q=cat&apikey=your-private-key"
```

The search response is compatible with the existing TESSA bot shape:

```json
{
  "status": true,
  "data": [
    {
      "title": "TikTok Video",
      "author": "username",
      "url": "https://www.tiktok.com/@username/video/123",
      "thumbnail": "https://...",
      "no_watermark": "https://your-service.onrender.com/api/tiktok/video?url=..."
    }
  ]
}
```

## Render

Build command:

```bash
npm install && npm run browser
```

Start command:

```bash
npm start
```

Use the same `API_KEY` in your bot and this API.

## Security

Never commit:

- `tiktok-cookie.txt`
- `.env`
- active TikTok session cookies

If a cookie has been exposed, revoke the session and export a fresh one.
# rakib-tik-api
