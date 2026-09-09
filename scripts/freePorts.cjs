const { execSync } = require('child_process');

function freePort(port) {
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
    // findstr exits with 1 if no process found
  }
}

const portsToClean = process.argv.slice(2).length > 0 ? process.argv.slice(2).map(Number) : [5000, 8080];

console.log(`🧹 DayFlow Port Cleaner: Checking port(s) ${portsToClean.join(', ')}...`);
for (const p of portsToClean) {
  if (p) freePort(p);
}
console.log(`✨ Port(s) ${portsToClean.join(', ')} are free and ready!`);
