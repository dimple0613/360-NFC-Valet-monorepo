const { execSync, spawn } = require('child_process');
const http = require('http');
const https = require('https');

// Start wrangler tail in background
const tail = spawn('D:\\Program Files\\nodejs\\npx.cmd', ['wrangler', 'tail', '--config', 'wrangler.jsonc', '--format', 'json'], {
  cwd: 'D:\\laragon\\www\\360-NFC-Valet-monorepo\\web',
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
tail.stdout.on('data', d => { output += d.toString(); console.log('TAIL:', d.toString().trim()); });
tail.stderr.on('data', d => { output += d.toString(); console.log('TAIL_ERR:', d.toString().trim()); });

// Wait 5 seconds for tail to connect, then make a request
setTimeout(() => {
  console.log('Making request to /api/mode...');
  https.get('https://360-nfc-valet.dimple-49d.workers.dev/api/mode', (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('Response status:', res.statusCode);
      console.log('Response body:', body.substring(0, 500));
      
      // Wait 3 more seconds for logs to arrive
      setTimeout(() => {
        tail.kill();
        console.log('\n=== FULL TAIL OUTPUT ===');
        console.log(output);
        process.exit(0);
      }, 5000);
    });
  }).on('error', e => {
    console.error('Request error:', e.message);
    tail.kill();
    process.exit(1);
  });
}, 5000);
