require('dotenv').config();
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

if (!clientId || !clientSecret) {
  console.error('Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const scopes = ['https://www.googleapis.com/auth/blogger'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: scopes
});

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = url.parse(req.url, true);
    
    if (reqUrl.pathname === '/oauth2callback') {
      const code = reqUrl.query.code;
      
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Error: No code provided in query.');
        return;
      }
      
      const { tokens } = await oauth2Client.getToken(code);
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Authentication successful!</h1><p>You can close this tab and check your console.</p>');
      
      console.log('\n--- SUCCESS ---');
      console.log(`Copy this refresh token to your .env file as GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('---------------\n');
      
      server.close(() => {
        process.exit(0);
      });
    }
  } catch (error) {
    console.error('Error during token exchange:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Authentication failed. Check console for details.');
    server.close(() => {
      process.exit(1);
    });
  }
});

server.listen(3000, async () => {
  console.log(`OAuth2 server listening on port 3000...`);
  console.log(`Opening browser to: ${authUrl}`);
  
  try {
    const open = (await import('open')).default;
    await open(authUrl);
  } catch (err) {
    console.log(`Could not automatically open browser. Please navigate to: ${authUrl}`);
  }
});
