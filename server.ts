import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import JSZip from 'jszip';

// Load our constants from the mock data as default base values
import { 
  INITIAL_LANGUAGES, 
  INITIAL_ANIME, 
  INITIAL_SEASONS, 
  INITIAL_EPISODES, 
  INITIAL_USERS, 
  INITIAL_SERVICE_CONNECTIONS, 
  INITIAL_ADS, 
  INITIAL_SECURITY_LOGS, 
  INITIAL_REALTIME_EVENTS, 
  INITIAL_FILE_ASSETS 
} from './src/db/mockData';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json({ limit: '50mb' }));

// Shared JSON database storage path in the container
const DB_FILE = path.join(process.cwd(), 'shared_database.json');

interface DBState {
  languages: any[];
  anime: any[];
  seasons: any[];
  episodes: any[];
  users: any[];
  connections: any;
  ads: any[];
  securityLogs: any[];
  realtimeEvents: any[];
  fileAssets: any[];
  theme: any;
}

// Ensure the shared database file exists with initial data
function loadDB(): DBState {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Error reading shared database, returning defaults:', e);
    }
  }

  const defaultState: DBState = {
    languages: INITIAL_LANGUAGES,
    anime: INITIAL_ANIME,
    seasons: INITIAL_SEASONS,
    episodes: INITIAL_EPISODES,
    users: INITIAL_USERS,
    connections: INITIAL_SERVICE_CONNECTIONS,
    ads: INITIAL_ADS,
    securityLogs: INITIAL_SECURITY_LOGS,
    realtimeEvents: INITIAL_REALTIME_EVENTS,
    fileAssets: INITIAL_FILE_ASSETS,
    theme: {
      primaryColor: '#e11d48',
      secondaryColor: '#be123c',
      bgColor: '#080a10',
      cardBgColor: '#0f1322',
      textColor: '#e2e8f0',
      fontFamily: 'Space Grotesk',
      borderRadius: '12px',
      headerStyle: 'glass',
      heroSliderLayout: 'standard'
    }
  };

  saveDB(defaultState);
  return defaultState;
}

function saveDB(state: DBState) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing shared database:', e);
  }
}

// API endpoint to fetch the entire database state
app.get('/api/shared-data', (req, res) => {
  try {
    const data = loadDB();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function serverGetFilesRecursively(dir: string, baseDir: string): Array<{ path: string; content: string }> {
  let results: Array<{ path: string; content: string }> = [];
  if (!fs.existsSync(dir)) return results;
  
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(serverGetFilesRecursively(fullPath, baseDir));
    } else {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const content = fs.readFileSync(fullPath).toString('base64');
      results.push({
        path: relativePath,
        content: content
      });
    }
  });
  return results;
}

function serverAddFilesRecursivelyToZip(dir: string, baseDir: string, zip: any) {
  if (!fs.existsSync(dir)) return;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    // Avoid large, transient, or sensitive directories
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.next' || file === '.parcel-cache') {
      return;
    }
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      serverAddFilesRecursivelyToZip(fullPath, baseDir, zip);
    } else {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const content = fs.readFileSync(fullPath);
      zip.file(relativePath, content);
    }
  });
}

// API endpoints to download Netlify and Source ZIP packages natively
app.get('/api/download-netlify-drop-zip', async (req, res) => {
  try {
    const zip = new JSZip();
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      const list = fs.readdirSync(distDir);
      list.forEach((file) => {
        const fullPath = path.join(distDir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          const addSubDir = (subDir: string, baseSubDir: string) => {
            const subList = fs.readdirSync(subDir);
            subList.forEach((subFile) => {
              const subFullPath = path.join(subDir, subFile);
              const subStat = fs.statSync(subFullPath);
              if (subStat && subStat.isDirectory()) {
                addSubDir(subFullPath, baseSubDir);
              } else {
                const relPath = path.relative(baseSubDir, subFullPath).replace(/\\/g, '/');
                zip.file(relPath, fs.readFileSync(subFullPath));
              }
            });
          };
          addSubDir(fullPath, distDir);
        } else {
          zip.file(file, fs.readFileSync(fullPath));
        }
      });
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end("dist folder not found. Please compile the app first or trigger a build.");
      return;
    }
    
    zip.file("_redirects", "/*  /index.html  200\r\n");

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="OtakuUniverse_Netlify_Drop_DeployReady.zip"');
    res.setHeader('Content-Length', buffer.length.toString());
    res.end(buffer);
  } catch (error: any) {
    res.status(500).send(error.message);
  }
});

app.get('/api/download-source-zip', async (req, res) => {
  try {
    const zip = new JSZip();
    serverAddFilesRecursivelyToZip(process.cwd(), process.cwd(), zip);

    // Add production server settings
    zip.file("Dockerfile", `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
`);

    zip.file("docker-compose.yml", `version: '3.8'
services:
  otaku-backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: always
`);

    zip.file(".env.production", `# Otaku Universe CMS Production Environment Configuration
PORT=3000
NODE_ENV=production
`);

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="OtakuUniverse_CMS_V4_ProductionBuild.zip"');
    res.setHeader('Content-Length', buffer.length.toString());
    res.end(buffer);
  } catch (error: any) {
    res.status(500).send(error.message);
  }
});

app.get('/api/dist-zip-payload', (req, res) => {
  try {
    const distDir = path.resolve(process.cwd(), 'dist');
    const files = serverGetFilesRecursively(distDir, distDir);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ files });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/source-zip-payload', (req, res) => {
  try {
    const results: Array<{ path: string; content: string }> = [];
    const rootFiles = ['package.json', 'vite.config.ts', 'tsconfig.json', 'index.html', 'netlify.toml', 'Dockerfile', 'render.yaml', 'README_DEPLOY.md'];
    
    rootFiles.forEach(file => {
      const fullPath = path.resolve(process.cwd(), file);
      if (fs.existsSync(fullPath)) {
        results.push({
          path: file,
          content: fs.readFileSync(fullPath).toString('base64')
        });
      }
    });

    const srcDir = path.resolve(process.cwd(), 'src');
    const srcFiles = serverGetFilesRecursively(srcDir, process.cwd());
    const allFiles = results.concat(srcFiles);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ files: allFiles });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Realtime active SSE connections list
let sseClients: Array<{
  id: string;
  res: any;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  userRole?: string;
}> = [];

// Broadcast helper for database updates
function broadcastState(db: DBState) {
  const payload = JSON.stringify({ type: 'state', db });
  sseClients.forEach(c => {
    try {
      c.res.write(`data: ${payload}\n\n`);
    } catch (err) {
      console.error(`Failed writing to SSE client ${c.id}:`, err);
    }
  });
}

// Broadcast helper for active online presences
function broadcastPresence() {
  const uniqueUsers: Record<string, { userId: string; name: string; avatar: string; role: string; lastSeen: number }> = {};
  
  sseClients.forEach(c => {
    if (c.userId && c.userName) {
      uniqueUsers[c.userId] = {
        userId: c.userId,
        name: c.userName,
        avatar: c.userAvatar || '',
        role: c.userRole || 'User',
        lastSeen: Date.now()
      };
    }
  });

  const presenceList = Object.values(uniqueUsers);
  const payload = JSON.stringify({ type: 'presence', presence: presenceList });
  
  sseClients.forEach(c => {
    try {
      c.res.write(`data: ${payload}\n\n`);
    } catch (err) {
      console.error(`Failed writing presence to SSE client ${c.id}:`, err);
    }
  });
}

// SSE live real-time connection stream endpoint
app.get('/api/realtime-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now().toString() + Math.random().toString(36).substring(2, 7);
  const userId = req.query.userId?.toString() || `anon-${Date.now()}`;
  const userName = req.query.userName?.toString() || 'Anonymous Otaku';
  const userAvatar = req.query.userAvatar?.toString() || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80';
  const userRole = req.query.userRole?.toString() || 'User';

  const newClient = {
    id: clientId,
    res,
    userId,
    userName,
    userAvatar,
    userRole
  };

  sseClients.push(newClient);

  // Send initial data to client
  try {
    const currentDb = loadDB();
    res.write(`data: ${JSON.stringify({ type: 'state', db: currentDb })}\n\n`);
  } catch (err) {
    console.error('Error sending initial database state:', err);
  }

  // Trigger broadcast to other sessions
  broadcastPresence();

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
    broadcastPresence();
  });
});

// API endpoint to update a portion of the database dynamically
app.post('/api/update-data', (req, res) => {
  try {
    const { key, data } = req.body;
    if (!key || data === undefined) {
      res.status(400).json({ error: 'Missing key or data' });
      return;
    }

    const dbState = loadDB();
    // Verify valid database key
    if (key in dbState) {
      (dbState as any)[key] = data;
      saveDB(dbState);
      
      // Update all live clients in active SSE sessions instantly!
      broadcastState(dbState);
      
      res.json({ success: true, message: `Stored database state for ${key} successfully.` });
    } else {
      res.status(400).json({ error: `Invalid database table: ${key}` });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  // Vite integration in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

startServer();
