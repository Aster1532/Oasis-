const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// --- KEEP-ALIVE SERVER ---
app.get('/', (req, res) => res.send('Oasis Ecosystem: Systems Operational.'));
app.listen(port, () => console.log(`Oasis Terminal running on port ${port}`));

// --- CORE DEPENDENCIES ---
require('dotenv').config();
const axios = require('axios');
const Parser = require('rss-parser');
const cron = require('node-cron');
const crypto = require('crypto');

const parser = new Parser({
  customFields: {
    item: [['media:content', 'mediaContent'], ['enclosure', 'enclosure'], ['content:encoded', 'contentEncoded']]
  }
});

// UNIFIED BRANDING
const BOT_AVATAR = "https://github.com/Aster1532/Bot-assets/blob/main/Picsart_26-01-04_00-27-24-969.jpg?raw=true";
const FOOTER_TEXT = "⭐ The Most Important Only • Oasis Terminal";

// Memory Storage
let sentHistory = [];
let weeklyMemory = [];
let narrativeMemory = []; // Stores headlines for the last 24h for AI context

// --- HELPER: IMAGE HUNTER ---
const extractImage = (item) => {
  if (item.enclosure && item.enclosure.url) return item.enclosure.url;
  if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) return item.mediaContent.$.url;
  if (item.contentEncoded) {
    const imgMatch = item.contentEncoded.match(/src="([^"]+)"/);
    if (imgMatch) return imgMatch[1];
  }
  return null;
};

// --- MODULE 1: REAL-TIME ENGINE ---
const runRealTimeEngine = async () => {
  console.log('🔍 Scanning Global Feeds...');
  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const item of feed.items.slice(0, 10)) {
        const uniqueString = (item.title || "") + (item.pubDate || "");
        const itemId = crypto.createHash('md5').update(uniqueString).digest('hex');
        if (sentHistory.includes(itemId)) continue;

        const headline = item.title || "";
        const cleanDesc = (item.contentSnippet || "").replace(/<[^>]*>?/gm, '').trim().substring(0, 450);
        const imageUrl = extractImage(item);

        const isMacro = /(FED|CPI|Inflation|Rates|FOMC|Powell|Recession|Hike|Cut|GDP|Treasury|NFP|BRICS|DXY|Federal Reserve|Gold|Silver|Central Bank|ECB|Debt|Yield|War|Conflict|Oil|Energy)/i.test(headline);
        const isCrypto = /(ETF|SEC|BlackRock|Binance|Gensler|Regulation|Bitcoin|BTC|ETH|Ethereum|Whale|Liquidity|Halving|XRP|Ripple|Stablecoin|MicroStrategy|Tether|USDC|Coinbase|Institutional)/i.test(headline);

        if (isMacro || isCrypto) {
          const bullish = /(Cut|Approval|Pump|Green|Bull|Rally|ETF|Adoption|Inflow|Gains|Record|Breakout|Whale Buy)/i.test(headline);
          const bearish = /(Hike|Panic|Crash|Dump|Drop|Inflation|Recession|SEC|Lawsuit|Hack|Outflow|Losses|War|Conflict)/i.test(headline);
          let color = 16777215; // White
          if (bullish) color = 3066993;
          else if (bearish) color = 15158332;

          const config = isMacro ? { webhook: process.env.WEBHOOK_MACRO, name: "OASIS | Macro Terminal", ping: process.env.ROLE_ID_MACRO } 
                                 : { webhook: process.env.WEBHOOK_CRYPTO, name: "OASIS | Crypto Intel", ping: process.env.ROLE_ID_ALPHA };

          await axios.post(config.webhook, {
            username: config.name,
            avatar_url: BOT_AVATAR,
            content: `<@&${config.ping}>`,
            embeds: [{
              title: `🚨 ${headline}`,
              description: cleanDesc,
              url: item.link,
              color: color,
              image: imageUrl ? { url: imageUrl } : null,
              footer: { text: FOOTER_TEXT }
            }]
          });

          weeklyMemory.push({ title: headline, link: item.link });
          narrativeMemory.push(headline);
          if (narrativeMemory.length > 100) narrativeMemory.shift();
        }
        sentHistory.push(itemId);
        if (sentHistory.length > 500) sentHistory.shift();
      }
    } catch (e) {}
  }
};

// --- MODULE 2: THE OASIS MORNING BRIEF (New Alpha Feature) ---
const runMorningBrief = async () => {
  console.log('🌅 Generating Morning Brief...');
  try {
    const recentNews = narrativeMemory.join("\n");
    const prompt = `You are a Senior Institutional Analyst. Analyze the news below and today's upcoming data.
    1. VOLATILITY DANGER ZONE: List only "High Impact" economic events for today (e.g., CPI, FOMC). If none, state "Clear Skies."
    2. INSTITUTIONAL FLOWS: Fetch yesterday's total BTC ETF net inflows/outflows (specifically BlackRock IBIT & Fidelity FBTC).
    3. MARKET NARRATIVE: In 2 sentences, define the "vibe" or focus of the market right now.
    
    News Context: ${recentNews}
    Format: Use bold headers and professional bullet points.`;

    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: "Generate the Morning Brief." }] }],
        systemInstruction: { parts: [{ text: prompt }] },
        tools: [{ "google_search": {} }]
      }
    );

    const brief = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (brief) {
      await axios.post(process.env.WEBHOOK_MARKET, {
        username: "OASIS | Intelligence",
        avatar_url: BOT_AVATAR,
        embeds: [{
          title: "🌅 OASIS MORNING BRIEF",
          description: brief,
          color: 16777215,
          footer: { text: "Pre-Market Institutional Analysis • Oasis Terminal" },
          timestamp: new Date()
        }]
      });
    }
  } catch (e) { console.error("Brief Error", e.message); }
};

// --- MODULE 3: MARKET DESK ---
const runMarketDesk = async (isOpen) => {
  try {
    const prompt = `Output ONLY: ▪️ **[Asset Name]**\n  🔹 Level: [Value] [Emoji]\n  🔹 24h Change: [Value] [Emoji]\nAssets: DXY, US 10Y Yield, S&P 500.`;
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Fetch data" }] }],
      systemInstruction: { parts: [{ text: prompt }] },
      tools: [{ "google_search": {} }]
    });
    let data = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (data) {
      await axios.post(process.env.WEBHOOK_MARKET, {
        username: "OASIS | Market Desk",
        avatar_url: BOT_AVATAR,
        embeds: [{
          title: isOpen ? "🔔 NYSE SESSION OPEN" : "🌆 NYSE SESSION CLOSE",
          description: data,
          color: 16777215,
          footer: { text: "Settlement Data • Oasis Terminal" }
        }]
      });
    }
  } catch (e) {}
};

// --- MODULE 4: WEEKLY WRAP & FEAR/GREED ---
const runWeeklyWrap = async () => { /* Logic remains same as previous */ };
const runFearGreed = async () => {
  await axios.post(process.env.WEBHOOK_MARKET, {
    username: "OASIS | Sentiment",
    avatar_url: BOT_AVATAR,
    embeds: [{
      title: "📊 DAILY MARKET SENTIMENT",
      image: { url: "https://alternative.me/crypto/fear-and-greed-index.png" },
      footer: { text: "Daily Market Sentiment Update • Oasis Terminal" }
    }]
  });
};

// --- SCHEDULES (UTC) ---
cron.schedule('*/5 * * * *', runRealTimeEngine);
cron.schedule('30 13 * * 1-5', runMorningBrief); // 8:30 AM EST (1 hr before open)
cron.schedule('30 14 * * 1-5', () => runMarketDesk(true)); // 9:30 AM EST Open
cron.schedule('0 21 * * 1-5', () => runMarketDesk(false)); // 4:00 PM EST Close
cron.schedule('0 19 * * 0', runWeeklyWrap); // Sunday Wrap
cron.schedule('0 1 * * *', runFearGreed); // 1 AM Daily
