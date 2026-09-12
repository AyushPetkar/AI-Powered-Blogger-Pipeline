const { google } = require('googleapis');
const config = require('../config/env');
const logger = require('../utils/logger');

let oauth2Client = null;

function getOAuth2Client() {
  if (!oauth2Client) {
    oauth2Client = new google.auth.OAuth2(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      config.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: config.GOOGLE_REFRESH_TOKEN,
    });

    // Listen for new tokens (auto-refresh)
    oauth2Client.on('tokens', (tokens) => {
      logger.info('OAuth2 access token refreshed successfully');
      if (tokens.refresh_token) {
        logger.info('New refresh token received');
      }
    });
  }

  return oauth2Client;
}

// Force refresh the access token
async function refreshAccessToken() {
  const client = getOAuth2Client();
  try {
    const { credentials } = await client.refreshAccessToken();
    client.setCredentials(credentials);
    logger.info('Access token manually refreshed');
    return credentials;
  } catch (error) {
    logger.error(`Failed to refresh access token: ${error.message}`);
    throw error;
  }
}

module.exports = { getOAuth2Client, refreshAccessToken };
