const https = require('https');
const query = `query { issue(id: "MIG-14") { state { type name } description } }`;
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
  res.on('end', () => console.log(data));
});
req.write(JSON.stringify({ query }));
req.end();
