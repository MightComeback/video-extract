const https = require('https');
const query = `query { issue(id: "MIG-14") { state { type } } }`;
const req = https.request({
  hostname: 'api.linear.app',
  path: '/graphql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': process.env.LINEAR_API_KEY
  }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    try {
      console.log(JSON.parse(data)?.data?.issue?.state?.type || 'unknown');
    } catch (e) { console.error(e); process.exit(1); }
  });
});
req.on('error', (e) => { console.error(e); process.exit(1); });
req.write(JSON.stringify({ query }));
req.end();
