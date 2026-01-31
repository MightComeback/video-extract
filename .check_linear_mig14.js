const https = require('https');

const query = `
  query {
    issue(id: "MIG-14") {
      state {
        type
        name
      }
      description
    }
  }
`;

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
      if (json.errors) {
        process.stdout.write(JSON.stringify({ error: json.errors }));
        process.exit(0); 
      }
      if (!json.data || !json.data.issue) {
         process.stdout.write(JSON.stringify({ error: "Issue not found" }));
         process.exit(0);
      }
      const stateType = json.data.issue.state.type;
      const stateName = json.data.issue.state.name;
      console.log(JSON.stringify({ type: stateType, name: stateName, description: json.data.issue.description }));
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
});

req.write(JSON.stringify({ query }));
req.end();
