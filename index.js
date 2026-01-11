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

// --- MODULE: REAL-TIME ENGINE ---
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

// --- MODULE: WEEKLY WRAP (THE SUNDAY REPORT) ---
const runWeeklyWrap = async () => {
  console.log('🗞️ Generating Weekly Wrap...');
  if (weeklyMemory.length < 3) {
      console.log("Not enough data in memory to wrap.");
      return;
  }

  try {
    const titles = weeklyMemory.map(i => i.title).join("\n");
    const prompt = `Senior Institutional Market Analyst. Review these headlines and generate a professional summary.
    - Exactly 3 bullets.
    - Each bullet starts with a Bold Header theme (e.g., **Institutional Flow**, **Macro Volatility**).
    - Use sophisticated terminology. No intro.
    Headlines:\n${titles}`;

    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Generate the Weekly Market Overview." }] }],
      systemInstruction: { parts: [{ text: prompt }] }
    });

    const summary = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    const primarySources = weeklyMemory.slice(-5).map(i => `• [${i.title}](${i.link})`).join("\n");

    if (summary) {
      await axios.post(process.env.WEBHOOK_WEEKLY, {
        username: "OASIS | Reports", avatar_url: BOT_AVATAR,
        embeds: [{
          title: "🗞️ MARKET OVERVIEW",
          description: `**Summary:**\n${summary}\n\n**Primary Source:**\n${primarySources}`,
          color: 16777215, image: { url: WEEKLY_HEADER_IMG }, footer: { text: WEEKLY_FOOTER }
        }]
      });
    }
    // We only reset if this wasn't a manual test trigger (logic handled in the route below)
  } catch (e) { console.error("Weekly Wrap Error:", e.message); }
};

// --- REMAINING MODULES (Brief, Recap, Watchdog, etc.) ---
const runMorningBrief = async () => { /* Logic hidden for brevity */ };
const runLondonHandover = async () => { /* Logic hidden for brevity */ };
const runKnowledgeDrop = async () => { /* Logic hidden for brevity */ };
const runPriceWatchdog = async () => { /* Logic hidden for brevity */ };
const runMarketDesk = async (isOpen) => { /* Logic hidden for brevity */ };
const runFearGreed = async () => { /* Logic hidden for brevity */ };

// --- SCHEDULES ---
cron.schedule('*/5 * * * *', runRealTimeEngine);
cron.schedule('*/15 * * * *', runPriceWatchdog);
cron.schedule('0 0,12 * * *', runKnowledgeDrop);
cron.schedule('0 12 * * 1-5', runLondonHandover);
cron.schedule('30 13 * * 1-5', runMorningBrief);
cron.schedule('30 14 * * 1-5', () => runMarketDesk(true));
cron.schedule('0 21 * * 1-5', () => runMarketDesk(false));
cron.schedule('0 1 * * *', runFearGreed);
cron.schedule('0 19 * * 0', async () => { await runWeeklyWrap(); weeklyMemory = []; });

// --- START SERVER ---
app.listen(port, () => console.log(`Oasis Terminal running on port ${port}`));

// --- !!! TEST TRIGGER ROUTE !!! ---
app.get('/test-wrap', async (req, res) => {
    console.log("Manual trigger for Weekly Wrap received...");
    
    // 1. Inject Mock Data (Sample news so it has something to summarize)
    weeklyMemory = [
        { title: "Bitcoin options boom raises fears of capped BTC upside", link: "https://cointelegraph.com/news/bitcoin-options-under-fire" },
        { title: "Fed Liquidity injection expected as DXY nears critical support", link: "https://cnbc.com/fed-liquidity" },
        { title: "The Bybit hack made Kim Jong Un crypto's most influential in 2025", link: "https://cointelegraph.com/news/bybit-hack" },
        { title: "BlackRock IBIT sees record $1.2B inflows in single session", link: "https://coindesk.com/blackrock-inflows" },
        { title: "US Treasury yields surge following NFP data beat", link: "https://cnbc.com/treasury-yields" }
    ];

    // 2. Run the function
    await runWeeklyWrap();

    res.send("<h1>Test Signal Sent!</h1><p>Check your Discord #weekly-wrap channel. I have injected 5 sample news items for this test.</p>");
});
