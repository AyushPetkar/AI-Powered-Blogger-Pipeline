const { GoogleGenAI } = require('@google/genai');
const config = require('../config/env');
const logger = require('../utils/logger');
const Article = require('../models/Article');
const { withRetry } = require('../utils/retry');

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

const categories = [
  'Technical Analysis Strategies', 'Fundamental Analysis for Beginners', 'Day Trading Tips',
  'Swing Trading Strategies', 'Value Investing Principles', 'Growth Stock Analysis',
  'Dividend Investing Guide', 'IPO Analysis and Strategies', 'Stock Market Psychology',
  'Risk Management in Trading', 'Portfolio Diversification', 'Cryptocurrency vs Stocks',
  'Options Trading Basics', 'Market Indicators Explained', 'Bull vs Bear Markets',
  'Stock Screener Strategies', 'Sector Analysis', 'Global Market Trends',
  'Earnings Reports Analysis', 'Beginner Investment Guide', 'Stock Market Myths Debunked',
  'ETF Investment Strategies', 'Mutual Funds vs Stocks', 'Financial Ratios Explained',
  'Market Volatility Strategies'
];

async function generateArticle() {
  try {
    logger.info('Fetching existing topics from database...');
    const existingArticles = await Article.find({}, 'topic')
      .sort({ createdAt: -1 })
      .limit(20)
      .exec();
    const existingTopics = existingArticles.map(a => a.topic).filter(Boolean);

    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    logger.info(`Selected random topic category: ${randomCategory}`);

    const prompt = `You are a professional financial content writer for GODSTOCKSS, a stock market education blog.
I need a unique, engaging article about the following category: "${randomCategory}".

Here are recently covered topics (do NOT repeat any of these topics. Generate a fresh, unique angle):
${existingTopics.length > 0 ? existingTopics.join(', ') : 'None so far.'}

Write an engaging, SEO-optimized stock market article between 500 and 650 words.
Keep it punchy, practical, and well-structured with proper HTML (use <h2>, <h3>, <p>, <ul>/<li> where appropriate).
Ensure any double quotes inside HTML attributes are properly escaped so the output is valid JSON.

Return ONLY a valid JSON object matching this schema:
{
  "title": "The article title",
  "content": "<HTML article body with proper tags>",
  "tags": ["tag1", "tag2", "tag3"],
  "topic": "A short summary of the specific topic covered"
}`;

    logger.info('Calling Gemini API to generate article content...');

    const callGemini = async () => {
      const response = await ai.models.generateContent({
        model: config.GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'SEO-friendly article title'
              },
              content: {
                type: 'string',
                description: 'Complete article body in HTML, around 500-650 words'
              },
              tags: {
                type: 'array',
                items: {
                  type: 'string'
                }
              },
              topic: {
                type: 'string',
                description: 'Short summary of the specific topic covered'
              }
            },
            required: [
              'title',
              'content',
              'tags',
              'topic'
            ],
            additionalProperties: false
          }
        }
      });
      return response;
    };

    const response = await withRetry(callGemini, { maxRetries: 3, baseDelay: 2000 });
    let responseText = response && response.text ? response.text.trim() : '';

    // Strip markdown code fences if model enclosed JSON in ```json ... ```
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (error) {
      logger.error(`Failed to parse Gemini JSON: ${error.message}. Response length: ${responseText.length}`);
      throw new Error(`Gemini returned invalid JSON: ${error.message}`);
    }

    if (!parsedResponse.title || !parsedResponse.content || !parsedResponse.tags || !parsedResponse.topic) {
      throw new Error('Invalid response format: missing required fields');
    }

    logger.info(`Successfully generated article: "${parsedResponse.title}"`);
    return parsedResponse;
  } catch (error) {
    logger.error(`Error generating article: ${error.message}`);
    throw error;
  }
}

module.exports = { generateArticle };
