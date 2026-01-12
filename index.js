const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// --- KEEP-ALIVE SERVER ---
app.get('/', (req, res) => res.send('Oasis Ecosystem: Systems Operational.'));

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

// --- BRANDING ASSETS ---
const BOT_AVATAR = "https://github.com/Aster1532/Bot-assets/blob/main/Picsart_26-01-04_00-27-24-969.jpg?raw=true";
const WEEKLY_HEADER_IMG = "https://raw.githubusercontent.com/Aster1532/Bot-assets/refs/heads/main/Picsart_25-12-24_19-16-44-741.jpg";

// --- FOOTER STRINGS ---
const MACRO_FOOTER = "Institutional Macro Feed • Oasis Terminal";
const CRYPTO_FOOTER = "Alpha News Feed • Oasis Terminal";
const WEEKLY_FOOTER = "⭐ The Most Important Only • Oasis Terminal";
const BRIEF_FOOTER = "Pre-Market Institutional Analysis • Oasis Terminal";
const LONDON_FOOTER = "Handover to New York Desk • Oasis Terminal";
const SENTIMENT_FOOTER = "Daily Market Sentiment Update • Oasis Terminal";
const ALERT_FOOTER = "Institutional Level Alert • Oasis Terminal";
const LIQ_FOOTER = "Liquidity Flow Analysis • Oasis Terminal";

// --- STATE MANAGEMENT ---
let sentHistory = [];
let weeklyMemory = []; 
let narrativeMemory = [];
let lastPrices = { bitcoin: 0, ethereum: 0, solana: 0, binancecoin: 0, gold: 0, silver: 0 };

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
  const feeds = ["https://cointelegraph.com/rss", "https://cryptopanic.com/news/rss/", "https://www.cnbc.com/id/10000664/device/rss/rss.html", "https://feeds.feedburner.com/coindesk"];
  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items.slice(0, 5)) {
        const hash = crypto.createHash('md5').update((item.title || "") + (item.pubDate || "")).digest('hex');
        if (sentHistory.includes(hash)) continue;
        const headline = item.title || "";
        const isMacro = /(FED|CPI|Inflation|Rates|FOMC|Powell|Recession|Hike|Cut|GDP|Treasury|NFP|BRICS|DXY|Federal Reserve|Gold|Silver|Central Bank|ECB|Debt|Yield|War|Conflict|Oil|Energy)/i.test(headline);
        const isCrypto = /(Bitcoin|BTC|ETH|Ethereum|Solana|SOL|XRP|Ripple|Binance|BNB|ETF|SATS|Stablecoin|Tether|USDC|Coinbase|Blockchain|Crypto|Altcoin)/i.test(headline);

        if (isMacro || isCrypto) {
          const bullish = /(Cut|Approval|Pump|Green|Bull|Rally|ETF|Adoption|Inflow|Gains|Record|Breakout|Whale Buy)/i.test(headline);
          const bearish = /(Hike|Panic|Crash|Dump|Drop|Inflation|Recession|SEC|Lawsuit|Hack|Outflow|Losses|War|Conflict)/i.test(headline);
          let color = 16777215;
          if (bullish) color = 3066993; else if (bearish) color = 15158332;

          let config = isCrypto ? { webhook: process.env.WEBHOOK_CRYPTO, name: "OASIS | Crypto Intel", ping: process.env.ROLE_ID_ALPHA, footer: CRYPTO_FOOTER }
                                : { webhook: process.env.WEBHOOK_MACRO, name: "OASIS | Macro Terminal", ping: process.env.ROLE_ID_MACRO, footer: MACRO_FOOTER };

          await axios.post(config.webhook, {
            username: config.name, avatar_url: BOT_AVATAR, content: `<@&${config.ping}>`,
            embeds: [{ title: `🚨 ${headline}`, description: (item.contentSnippet || "").substring(0, 400), url: item.link, color: color, image: extractImage(item) ? { url: extractImage(item) } : null, footer: { text: config.footer } }]
          });
          weeklyMemory.push({ title: headline, link: item.link });
          narrativeMemory.push(headline);
        }
        sentHistory.push(hash);
      }
    } catch (e) {}
  }
};

// --- MODULE 2: SENTIMENT (FEAR & GREED) ---
const runFearGreed = async () => {
  console.log('📊 Generating Sentiment Report...');
  try {
    // We use the dynamic image which Alternative.me updates daily
    const imageUrl = "https://alternative.me/crypto/fear-and-greed-index.png";
    
    // We fetch the data just to log the value, but rely on the image for the post
    const res = await axios.get("https://api.alternative.me/fng/?limit=1");
    const data = res.data.data[0];
    console.log(`Sentiment Value: ${data.value}`);

    await axios.post(process.env.WEBHOOK_MARKET, {
      username: "OASIS | Sentiment",
      avatar_url: BOT_AVATAR,
      embeds: [{
        title: "📊 DAILY MARKET SENTIMENT",
        color: 16777215, // White
        image: { url: imageUrl },
        footer: { text: SENTIMENT_FOOTER }
      }]
    });
  } catch (e) {
    console.error("Sentiment Error:", e.message);
  }
};

// --- REMAINING MODULES ---
const runLiquidationWatch = async () => { /* Logic hidden */ };
const runWeeklyWrap = async () => { /* Logic hidden */ };
const runMorningBrief = async () => { /* Logic hidden */ };
const runLondonHandover = async () => { /* Logic hidden */ };
const runKnowledgeDrop = async () => { /* Logic hidden */ };
const runPriceWatchdog = async () => { /* Logic hidden */ };
const runMarketDesk = async (isOpen) => { /* Logic hidden */ };

// --- SCHEDULES (UTC) ---
cron.schedule('*/5 * * * *', runRealTimeEngine);
cron.schedule('0 */4 * * *', runLiquidationWatch);
cron.schedule('*/15 * * * *', runPriceWatchdog);
cron.schedule('0 0,12 * * *', runKnowledgeDrop);
cron.schedule('0 12 * * 1-5', runLondonHandover);
cron.schedule('30 13 * * 1-5', runMorningBrief);
cron.schedule('30 14 * * 1-5', () => runMarketDesk(true));
cron.schedule('0 21 * * 1-5', () => runMarketDesk(false));
// UPDATED: Fear & Greed now runs at 8:00 AM UTC (Safe Time)
cron.schedule('0 8 * * *', runFearGreed);
cron.schedule('0 19 * * 0', async () => { await runWeeklyWrap(); weeklyMemory = []; });

app.listen(port, () => console.log(`Oasis Terminal v3.2 Running`));

// --- TEST ROUTES ---
app.get('/test-sentiment', async (req, res) => { await runFearGreed(); res.send("Sentiment Triggered"); });
app.get('/test-liq', async (req, res) => { await runLiquidationWatch(); res.send("Liquidation Triggered"); });
app.get('/test-wrap', async (req, res) => { weeklyMemory=[{title:"Test",link:"#"}]; await runWeeklyWrap(); res.send("Wrap Triggered"); });
