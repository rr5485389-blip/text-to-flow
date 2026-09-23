<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Text to Flow - AI Workflow & Diagram Generator

Transform plain text and process descriptions into beautiful, structured visual flowcharts and Figma diagrams powered by Google Gemini.

## 🚀 Run Locally

**Prerequisites:** Node.js 20+

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY="your_gemini_api_key_here"
   APP_URL="http://localhost:3000"
   ```
   *(Get your free API key at [Google AI Studio](https://aistudio.google.com/app/apikey))*

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Build & run production server:**
   ```bash
   npm run build
   npm start
   ```

---

## 🌐 Publish & Deploy Online (Free & Public Access)

Because this app uses Google Gemini and backend endpoints (`/api`), it runs as a full-stack Node.js web service.

### Option 1: Deploy on Render (Recommended & Free)

1. Push your latest code to GitHub:
   ```bash
   git add .
   git commit -m "Configure production deployment"
   git push origin main
   ```
2. Go to [Render.com](https://render.com) and sign in with GitHub.
3. Click **New +** > **Web Service**.
4. Select your repository (`text-to-flow`).
5. Configure the service:
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free
6. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: *(Your Google Gemini API key)*
   - `APP_URL`: *(Your public Render service URL, e.g. `https://text-to-flow.onrender.com`)*
7. Click **Create Web Service**. Your public URL will be live in 2-3 minutes!

---

### Option 2: Deploy on Railway

1. Sign in to [Railway.app](https://railway.app) with GitHub.
2. Click **New Project** > **Deploy from GitHub repo**.
3. Select `text-to-flow`.
4. Go to **Variables** and add:
   - `GEMINI_API_KEY`: *(Your Google Gemini API key)*
5. Go to **Settings** > **Networking** > click **Generate Domain**.
6. Railway builds and deploys your app automatically!

---

### Option 3: Deploy with Docker / Cloud Run

A production-ready [Dockerfile](Dockerfile) is included:
```bash
docker build -t text-to-flow .
docker run -p 3000:3000 -e GEMINI_API_KEY="your_key" text-to-flow
```
You can also deploy directly to **Google Cloud Run**:
```bash
gcloud run deploy text-to-flow --source . --set-env-vars GEMINI_API_KEY="your_key" --allow-unauthenticated
```

