import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './server/api.ts';
import { handleFigmaOAuthCallback } from './server/figmaRestService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Mount API routes
app.use('/api', apiRouter);

// Mount OAuth callback routes
app.get(['/auth/callback', '/auth/callback/'], handleFigmaOAuthCallback);

// Serve project zip directly
app.get('/figma-workflow-agent.zip', (req, res) => {
  const possiblePaths = [
    path.resolve(process.cwd(), 'public/figma-workflow-agent.zip'),
    path.resolve(__dirname, 'public/figma-workflow-agent.zip'),
    path.resolve(__dirname, '../public/figma-workflow-agent.zip'),
  ];
  const zipPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
  res.download(zipPath, 'figma-workflow-agent.zip');
});

// Serve static assets from production build if available
const distPath = [
  path.resolve(process.cwd(), 'dist'),
  path.resolve(__dirname, 'dist'),
  __dirname,
].find(p => fs.existsSync(path.join(p, 'index.html'))) || path.resolve(process.cwd(), 'dist');

app.use(express.static(distPath));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Workflow Agent Server listening on port ${PORT}`);
});
