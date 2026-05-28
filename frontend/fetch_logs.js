const fs = require('fs');
const https = require('https');

const buildJson = JSON.parse(fs.readFileSync('build.json', 'utf8'));
const url = buildJson.logFiles[0];

https.get(url, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const lines = data.split('\n');
    lines.forEach(line => {
      try {
        const j = JSON.parse(line);
        if (j.msg && (j.msg.includes('FAILED') || j.msg.includes('e: ') || j.msg.includes('Exception') || j.msg.includes('error:') || j.msg.includes('Unresolved reference'))) {
          console.log(j.msg);
        }
      } catch(e) {
        if (line.includes('FAILED') || line.includes('e: ')) console.log(line);
      }
    });
  });
}).on('error', e => console.error(e));
