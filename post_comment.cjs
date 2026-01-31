const https = require('https');

const commitUrl = process.argv[2];
if (!commitUrl) {
  console.error('Missing commit URL');
  process.exit(1);
}

const body = `Implemented Loom oEmbed metadata fetching: ${commitUrl}`;

const query = `
mutation {
  commentCreate(input: { 
    issueId: "MIG-14", 
    body: "${body}"
  }) {
    success
    comment {
      url
    }
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
    console.log('Linear response:', data);
  });
});

req.write(JSON.stringify({ query }));
req.end();
