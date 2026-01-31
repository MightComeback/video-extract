const https = require('https');

const data = JSON.stringify({
  query: `query { issue(id: "MIG-14") { state { type } } }`
});

const req = https.request({
  hostname: 'api.linear.app',
  path: '/graphql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': process.env.LINEAR_API_KEY,
    'Content-Length': data.length
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(body);
      const type = json.data?.issue?.state?.type;
      console.log(type || 'UNKNOWN'); 
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
});

req.on('error', error => {
  console.error(error);
  process.exit(1);
});

req.write(data);
req.end();