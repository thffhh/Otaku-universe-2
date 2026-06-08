import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

import fs from 'fs';
import JSZip from 'jszip';

function getFilesRecursively(dir: string, baseDir: string): Array<{ path: string; content: string }> {
  let results: Array<{ path: string; content: string }> = [];
  if (!fs.existsSync(dir)) return results;
  
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, baseDir));
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

function addFilesRecursivelyToZip(dir: string, baseDir: string, zip: any) {
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
      addFilesRecursivelyToZip(fullPath, baseDir, zip);
    } else {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const content = fs.readFileSync(fullPath);
      zip.file(relativePath, content);
    }
  });
}

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'serve-dist-files-plugin',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && req.url.startsWith('/api/download-netlify-drop-zip')) {
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
                return;
              } catch (error: any) {
                res.statusCode = 500;
                res.end(error.message);
                return;
              }
            }

            if (req.url && req.url.startsWith('/api/download-source-zip')) {
              try {
                const zip = new JSZip();
                addFilesRecursivelyToZip(process.cwd(), process.cwd(), zip);

                // Add useful production server files
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
                return;
              } catch (error: any) {
                res.statusCode = 500;
                res.end(error.message);
                return;
              }
            }
            if (req.url && req.url.startsWith('/api/dist-zip-payload')) {
              try {
                const distDir = path.resolve(process.cwd(), 'dist');
                const files = getFilesRecursively(distDir, distDir);
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ files }));
                return;
              } catch (error: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: error.message }));
                return;
              }
            }
            if (req.url && req.url.startsWith('/api/source-zip-payload')) {
              try {
                const results: Array<{ path: string; content: string }> = [];
                const rootFiles = ['package.json', 'vite.config.ts', 'tsconfig.json', 'index.html', 'netlify.toml'];
                
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
                const srcFiles = getFilesRecursively(srcDir, process.cwd());
                const allFiles = results.concat(srcFiles);

                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ files: allFiles }));
                return;
              } catch (error: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: error.message }));
                return;
              }
            }
            next();
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
