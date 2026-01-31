const https = require('https');
const query = JSON.stringify({
  query: 'query { issue(id: "MIG-14") { state { type name } } }'
});
const req = https.request('https://api.linear.app/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': process.env.LINEAR_API_KEY
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.errors) { console.error(JSON.stringify(json.errors)); process.exit(1); }
      const state = json.data.issue.state;
      console.log(JSON.stringify(state));
    } catch(e) { console.error(e); process.exit(1); }
  });
});
req.on('error', (e) => { console.error(e); process.exit(1); });
req.write(query);
req.end();
