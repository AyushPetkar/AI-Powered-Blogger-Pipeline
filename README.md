# AI-Powered Blogger Automation

Hands-free Node.js backend pipeline for GODSTOCKSS that generates stock market education articles with Gemini AI, stores them in MongoDB, and publishes them to Blogger.com on an hourly schedule.

## What It Does

```text
Cron / manual trigger
  -> claim next PENDING or retryable FAILED article
  -> generate a new article if the queue is empty
  -> save it in MongoDB as PENDING
  -> atomically mark it PUBLISHING
  -> publish through Blogger API v3
  -> mark it PUBLISHED or FAILED
```

## Tech Stack

- Backend: Node.js, Express.js
- Database: MongoDB, Mongoose
- AI: Google Gemini via `@google/genai`
- Publishing: Google Blogger API v3
- Auth: OAuth 2.0 refresh-token flow
- Scheduler: `node-cron`
- Logging: Winston
- Dashboard: React + Vite, served from Express after build

## Requirements

- Node.js `>=20.19.0`
- MongoDB running locally or in MongoDB Atlas
- Google Cloud project with Blogger API enabled
- OAuth 2.0 client credentials
- Gemini API key from Google AI Studio
- Blogger test blog and Blog ID

## Setup

1. Install backend dependencies:

```bash
npm install
```

2. Install frontend dependencies:

```bash
npm install --prefix frontend
```

3. Copy and fill environment variables:

- **Linux / macOS / PowerShell**:
  ```bash
  cp .env.example .env
  ```
- **Windows Command Prompt (cmd)**:
  ```cmd
  copy .env.example .env
  ```

Required values:

```text
MONGODB_URI=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
GOOGLE_REFRESH_TOKEN=
BLOGGER_BLOG_ID=
PORT=3000
CRON_SCHEDULE=0 * * * *
ADMIN_API_KEY=
```

> **Note**: In your Google Cloud Console, ensure `http://localhost:3000/oauth2callback` is added as an **Authorized redirect URI** for your OAuth 2.0 Web Client, and enable the **Blogger API v3**.

4. Get the Blogger refresh token:

```bash
npm run get-token
```

5. Build the dashboard:

```bash
npm run build
```

6. Start the backend:

```bash
npm start
```

Open `http://localhost:3000` to view the dashboard.

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/` | Dashboard UI or JSON status |
| GET | `/api/stats` | Counts by article status, DB state, uptime, cron schedule |
| GET | `/api/config` | Client configuration (e.g. checks if `adminAuthRequired`) |
| GET | `/health` | Server health check and pipeline status |
| GET | `/articles` | Recent articles, with optional `status`, `search`, and `limit` query params |
| GET | `/articles/:id` | Full article details |
| POST | `/trigger` | Run the generate/publish pipeline now |
| POST | `/articles/:id/retry` | Retry a failed or pending article |
| POST | `/api/recover` | Start recovery for pending/failed articles |

If `ADMIN_API_KEY` is configured, protected POST endpoints require an `x-api-key` header or `apiKey` query parameter.

## Status Lifecycle

- `PENDING`: Article exists and is waiting to publish.
- `PUBLISHING`: A worker has claimed the article and is sending it to Blogger.
- `PUBLISHED`: Blogger accepted the post and returned a live URL.
- `FAILED`: Generation or publishing failed. Articles with fewer than 3 retry attempts are recoverable.

The `PUBLISHING` state prevents two running processes from publishing the same article at the same time. Stale publishing locks older than 15 minutes are converted back into retryable failures during recovery.

## Crash Recovery

On startup, the app:

1. Connects to MongoDB.
2. Converts stale `PUBLISHING` locks into `FAILED`.
3. Claims retryable `PENDING` or `FAILED` articles one at a time.
4. Publishes them to Blogger with pacing between requests.
5. Starts the hourly scheduler.

## Demo Checklist

For the 3-5 minute video demo, show:

1. `src/` code structure and the main flow in `src/jobs/articlePipeline.js`.
2. MongoDB article changing from `PENDING` to `PUBLISHING` to `PUBLISHED`.
3. Dashboard metrics updating after a manual trigger.
4. Blogger test site showing the newly published post.
5. Logs showing successful generation and Blogger URL.

## Useful Commands

```bash
npm start
npm run dev
npm run get-token
npm run client:dev
npm run build
```

## Project Structure

```text
src/
  app.js
  config/
    database.js
    env.js
  jobs/
    articlePipeline.js
    scheduler.js
  middleware/
    requireAdminKey.js
  models/
    Article.js
  routes/
    articleRoutes.js
    pipelineRoutes.js
    statusRoutes.js
  services/
    aiService.js
    bloggerService.js
    tokenService.js
  utils/
    logger.js
    retry.js
scripts/
  getRefreshToken.js
frontend/
  src/
public/
  index.html
  assets/
```


