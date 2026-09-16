/**
 * DayFlow SSL Certificate Helper
 * Generates local self-signed certificates for HTTPS testing in development/staging
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sslDir = path.join(__dirname, '..', 'nginx', 'ssl');

if (!fs.existsSync(sslDir)) {
  fs.mkdirSync(sslDir, { recursive: true });
}

const certPath = path.join(sslDir, 'cert.pem');
const keyPath = path.join(sslDir, 'key.pem');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  console.log('✅ SSL certificates already exist in nginx/ssl/');
  process.exit(0);
}

// Locate openssl binary
let opensslCmd = 'openssl';
const candidatePaths = [
  'openssl',
  'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
  'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe'
];

for (const p of candidatePaths) {
  try {
    execSync(`"${p}" version`, { stdio: 'ignore' });
    opensslCmd = p;
    break;
  } catch (e) {}
}

console.log(`🔐 Generating self-signed SSL certificate using ${opensslCmd}...`);
try {
  execSync(
    `"${opensslCmd}" req -x509 -nodes -days 365 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`,
    { stdio: 'inherit' }
  );
  console.log('✅ SSL certificates with SAN (localhost) generated successfully at nginx/ssl/cert.pem and nginx/ssl/key.pem');
} catch (e) {
  console.error('❌ Failed to generate SSL certificates:', e.message);
  process.exit(1);
}
