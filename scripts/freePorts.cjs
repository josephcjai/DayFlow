// Safety Check: Never run port killing in production environments
if (process.env.NODE_ENV === 'production') {
  console.log('🛡️ DayFlow Port Cleaner: Skipped in production environment.');
  process.exit(0);
}

const { execSync } = require('child_process');

function freePort(port) {
  const isWin = process.platform === 'win32';

  if (isWin) {
    // Windows: netstat + taskkill
    try {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          const localAddr = parts[1];
          const pid = parts[parts.length - 1];
          if (localAddr && localAddr.endsWith(`:${port}`) && pid && pid !== '0' && pid !== String(process.pid)) {
            pids.add(pid);
          }
        }
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          console.log(`✅ Freed port ${port} by terminating PID ${pid}`);
        } catch (e) {}
      }
    } catch (e) {
      // findstr exits with code 1 if no matching port found
    }
  } else {
    // macOS / Linux: lsof + kill
    try {
      const output = execSync(`lsof -ti :${port}`, { encoding: 'utf8' });
      const pids = output.trim().split('\n').map(p => p.trim()).filter(Boolean);
      for (const pid of pids) {
        if (pid !== String(process.pid)) {
          try {
            execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
            console.log(`✅ Freed port ${port} by terminating PID ${pid}`);
          } catch (e) {}
        }
      }
    } catch (e) {
      // lsof exits with 1 if no process found
    }
  }
}

const portsToClean = process.argv.slice(2).length > 0 ? process.argv.slice(2).map(Number) : [5000, 8080];

console.log(`🧹 DayFlow Port Cleaner: Checking port(s) ${portsToClean.join(', ')}...`);
for (const p of portsToClean) {
  if (p) freePort(p);
}
console.log(`✨ Port(s) ${portsToClean.join(', ')} are free and ready!`);
