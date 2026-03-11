const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const clientDir = path.join(rootDir, 'client');
const serverDir = __dirname;
const distDir = path.join(serverDir, 'dist');

const externalModules = ['sharp', 'sqlite3', 'ffmpeg-static', 'robotjs'];

async function build() {
  console.log('🔨 Building full-stack app...\n');
  
  // 1. Build frontend first
  console.log('📦 Step 1: Building frontend...');
  const clientDistDir = path.join(clientDir, 'dist');
  try {
    execSync('npm run build', {
      stdio: 'inherit',
      cwd: clientDir
    });
    console.log('  ✓ Frontend build complete\n');
  } catch (err) {
    console.error('  ✗ Frontend build failed');
    throw err;
  }
  
  // 2. Clean and bundle backend
  console.log('📦 Step 2: Building backend...');
  console.log('  Cleaning dist...');
  await fs.emptyDir(distDir);
  
  console.log('  Bundling with esbuild...');
  const externals = externalModules.map(m => `--external:${m}`).join(' ');
  execSync(`npx esbuild src/index.js --bundle --platform=node --outfile=dist/server.js ${externals}`, {
    stdio: 'inherit',
    cwd: serverDir
  });
  console.log('  ✓ Backend bundle complete\n');
  
  // 3. Copy frontend dist to backend dist
  console.log('📦 Step 3: Copying frontend assets...');
  const frontendDestDir = path.join(distDir, 'public');
  if (await fs.pathExists(clientDistDir)) {
    await fs.copy(clientDistDir, frontendDestDir);
    console.log('  ✓ Frontend copied to dist/public\n');
  } else {
    console.log('  ⚠ Frontend dist not found, skipping...\n');
  }
  
  // 4. Create package.json with native dependencies
  console.log('📦 Step 4: Creating package.json...');
  const serverPkg = await fs.readJson(path.join(serverDir, 'package.json'));
  const nativeDeps = {};
  for (const mod of externalModules) {
    if (serverPkg.dependencies && serverPkg.dependencies[mod]) {
      nativeDeps[mod] = serverPkg.dependencies[mod];
    }
  }
  
  const distPkg = {
    name: 'cloudgallery-server',
    version: '1.0.0',
    main: 'server.js',
    scripts: {
      start: 'node server.js'
    },
    dependencies: nativeDeps
  };
  await fs.writeJson(path.join(distDir, 'package.json'), distPkg, { spaces: 2 });
  console.log('  ✓ package.json created with:', Object.keys(nativeDeps).join(', '), '\n');
  
  // 5. Add Docker support files
  console.log('📦 Step 5: Adding Docker support...');
  const dockerContent = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]`;
  await fs.writeFile(path.join(distDir, 'Dockerfile'), dockerContent);
  
  const dockerIgnoreContent = `node_modules\ndata\n*.log\n.DS_Store`;
  await fs.writeFile(path.join(distDir, '.dockerignore'), dockerIgnoreContent);
  
  const composeContent = `version: '3.8'

services:
  cloudgallery:
    build: .
    container_name: cloudgallery
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3001
    restart: unless-stopped
`;
  await fs.writeFile(path.join(distDir, 'docker-compose.yml'), composeContent);
  
  console.log('  ✓ Docker files added\n');
  
  console.log('✅ Build complete! Deploy the dist folder:');
  console.log('   1. Copy dist folder to target server');
  console.log('   2. Run: cd dist && npm install');
  console.log('   3. Run: node server.js');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
