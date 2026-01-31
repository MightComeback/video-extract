const https = require('https');

const query = `mutation {
  commentCreate(input: {
    issueId: "MIG-14",
    body: "Verified summary fallback behavior for whitespace-only inputs with a new regression test.\n\nhttps://github.com/MightComeback/fathom-extract/commit/d74fbc835aabaf88e5be2684beeb2e0c4ddf689b"
  }) {
    success
    comment { id }
  }
}`;

const req = https.request('https://api.linear.app/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': process.env.LINEAR_API_KEY
  }
}, (res) => {
  res.pipe(process.stdout);
});

req.write(JSON.stringify({ query }));
req.end();
