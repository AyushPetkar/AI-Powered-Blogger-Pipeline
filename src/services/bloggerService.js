const { google } = require('googleapis');
const config = require('../config/env');
const { getOAuth2Client, refreshAccessToken } = require('./tokenService');
const logger = require('../utils/logger');
const { withRetry } = require('../utils/retry');

async function publishPost(title, content, tags) {
  const auth = getOAuth2Client();
  const blogger = google.blogger({ version: 'v3', auth });

  const apiCall = async () => {
    try {
      const response = await blogger.posts.insert({
        blogId: config.BLOGGER_BLOG_ID,
        requestBody: {
          title,
          content,
          labels: tags,
        },
      });
      return response;
    } catch (error) {
      if (error.code === 401 || error.status === 401) {
        logger.warn('401 Unauthorized encountered, refreshing token before retry...');
        await refreshAccessToken();
        throw new Error('Retrying after token refresh');
      }
      throw error;
    }
  };

  try {
    const response = await withRetry(apiCall, { maxRetries: 3 });
    logger.info(`Successfully published post to Blogger: ${title}`);
    return { postId: response.data.id, url: response.data.url };
  } catch (error) {
    logger.error(`Failed to publish post: ${error.message}`);
    throw error;
  }
}

async function deletePost(postId) {
  const auth = getOAuth2Client();
  const blogger = google.blogger({ version: 'v3', auth });

  try {
    await blogger.posts.delete({
      blogId: config.BLOGGER_BLOG_ID,
      postId,
    });
    logger.info(`Successfully deleted post ${postId} from Blogger`);
    return true;
  } catch (error) {
    logger.error(`Failed to delete post ${postId} from Blogger: ${error.message}`);
    return false;
  }
}

module.exports = { publishPost, deletePost };
