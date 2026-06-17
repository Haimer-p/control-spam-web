# Twitter Bot Dashboard (control-spam-web)

Next.js dashboard để quản lý accounts, campaigns và gửi lệnh start/stop cho worker local.

## Dev local

```bash
cd control-spam-web
npm install
cp .env.local.example .env.local   # chỉnh MONGODB_URI, DASHBOARD_USER, ...
npm run dev
```

Mở http://localhost:3000

Khi dev cùng repo bot (`tool-farm-twitter`), có thể copy biến từ `.env` gốc sang `.env.local` hoặc để `next.config.js` đọc `../.env`.

## Deploy Vercel

Import repo **control-spam-web** (root = project root). Thêm env:

- `MONGODB_URI`
- `GEMINI_API_KEY` / `DEEPSEEK_API_KEY`
- `COOKIE_ENCRYPTION_KEY`
- `DASHBOARD_USER` / `DASHBOARD_PASSWORD`

Worker Puppeteer chạy riêng trên máy local: `npm run worker` (repo bot).
