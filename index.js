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
let lastPrices = { bitcoin: 0, ethereum: 0, solana: 0, binancecoin: 0 };

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
      for (const item of feed.items.slice(0, 10)) {
        const hash = crypto.createHash('md5').update((item.title || "") + (item.pubDate || "")).digest('hex');
        if (sentHistory.includes(hash)) continue;

        const headline = item.title || "";
        const cryptoTerms = /(Bitcoin|BTC|ETH|Ethereum|Solana|SOL|XRP|Ripple|Binance|BNB|ETF|Stablecoin|Tether|USDC|Coinbase|Blockchain|Crypto|Altcoin)/i;
        const macroTerms = /(FED|CPI|Inflation|Rates|FOMC|Powell|Recession|Hike|Cut|GDP|Treasury|NFP|BRICS|DXY|Federal Reserve|Gold|Silver|Central Bank|ECB|Debt|Yield|War|Conflict|Oil|Energy)/i;

        let config = null;
        if (cryptoTerms.test(headline)) {
          config = { webhook: process.env.WEBHOOK_CRYPTO, name: "OASIS | Crypto Intel", ping: process.env.ROLE_ID_ALPHA, footer: CRYPTO_FOOTER };
        } else if (macroTerms.test(headline)) {
          config = { webhook: process.env.WEBHOOK_MACRO, name: "OASIS | Macro Terminal", ping: process.env.ROLE_ID_MACRO, footer: MACRO_FOOTER };
        }

        if (config) {
          const bullish = /(Cut|Approval|Pump|Green|Bull|Rally|ETF|Adoption|Inflow|Gains|Record|Breakout|Whale Buy)/i.test(headline);
          const bearish = /(Hike|Panic|Crash|Dump|Drop|Inflation|Recession|SEC|Lawsuit|Hack|Outflow|Losses|War|Conflict)/i.test(headline);
          let color = 16777215;
          if (bullish) color = 3066993; else if (bearish) color = 15158332;

          await axios.post(config.webhook, {
            username: config.name, avatar_url: BOT_AVATAR, content: `<@&${config.ping}>`,
            embeds: [{ title: `🚨 ${headline}`, description: (item.contentSnippet || "").substring(0, 400), url: item.link, color: color, image: extractImage(item) ? { url: extractImage(item) } : null, footer: { text: config.footer } }]
          });
          weeklyMemory.push({ title: headline, link: item.link });
          narrativeMemory.push(headline);
        }
        sentHistory.push(hash);
        if (sentHistory.length > 500) sentHistory.shift();
      }
    } catch (e) {}
  }
};

// --- MODULE 2: LIQUIDATION WATCH (V3 Alpha) ---
const runLiquidationWatch = async () => {
  console.log('💥 Scanning for Whales in Trouble...');
  try {
    const prompt = `You are a Professional Risk Manager. Search for the latest Crypto Liquidation Heatmap data (last 4-24 hours).
    Identify:
    1. MAJOR LIQUIDATION WALLS: Prices where over $50M in longs or shorts are sitting (BTC/ETH/SOL).
    2. WHALE LIQUIDATIONS: Did any single liquidation over $1M occur recently?
    3. RISK LEVEL: Is the market currently set up for a "Long Squeeze" or "Short Squeeze"?
    
    Format: Use 💥 for liquidations, ⚠️ for risk warnings, and 📉/📈 for price walls. Keep it institutional and cold. No intro.`;

    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Analyze Liquidation Heatmaps." }] }],
      systemInstruction: { parts: [{ text: prompt }] },
      tools: [{ "google_search": {} }]
    });

    const analysis = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (analysis) {
      await axios.post(process.env.WEBHOOK_LIQUIDATIONS, {
        username: "OASIS | Liquidity Tracker",
        avatar_url: BOT_AVATAR,
        embeds: [{
          title: "🔥 LIQUIDATION & WHALE TRACKER",
          description: analysis,
          color: 15158332, // Red for high-risk data
          footer: { text: LIQ_FOOTER },
          timestamp: new Date()
        }]
      });
    }
  } catch (e) { console.error("Liq Tracker Error:", e.message); }
};

// --- MODULE: WEEKLY WRAP (Sunday 7 PM) ---
const runWeeklyWrap = async () => {
  if (weeklyMemory.length < 5) return;
  try {
    const titles = weeklyMemory.map(i => i.title).join("\n");
    const prompt = `Senior Institutional Analyst. Generate 3-bullet summary with bold headers theme. Headlines:\n${titles}`;
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Generate the Weekly Market Overview." }] }], systemInstruction: { parts: [{ text: prompt }] }
    });
    const summary = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    const primarySources = weeklyMemory.slice(-5).map(i => `• [${i.title}](${i.link})`).join("\n");
    if (summary) {
      await axios.post(process.env.WEBHOOK_WEEKLY, {
        username: "OASIS | Reports", avatar_url: BOT_AVATAR,
        embeds: [{ title: "🗞️ MARKET OVERVIEW", description: `**Summary:**\n${summary}\n\n**Primary Source:**\n${primarySources}`, color: 16777215, image: { url: WEEKLY_HEADER_IMG }, footer: { text: WEEKLY_FOOTER } }]
      });
    }
    weeklyMemory = [];
  } catch (e) {}
};

// --- REMAINING SCHEDULED MODULES ---
const runMorningBrief = async () => {
    try {
        const prompt = `Senior Analyst. Generate Brief: 1. VOLATILITY DANGER ZONE. 2. INSTITUTIONAL FLOWS. 3. NARRATIVE. Context: ${narrativeMemory.slice(-20).join(". ")}`;
        const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          contents: [{ parts: [{ text: "Create Morning Brief" }] }], systemInstruction: { parts: [{ text: prompt }] }, tools: [{ "google_search": {} }]
        });
        const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
            await axios.post(process.env.WEBHOOK_MARKET, { username: "OASIS | Intelligence", avatar_url: BOT_AVATAR, embeds: [{ title: "🌅 OASIS MORNING BRIEF", description: text, color: 16777215, footer: { text: BRIEF_FOOTER } }] });
        }
    } catch (e) {}
};

const runPriceWatchdog = async () => {
  try {
    const res = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd");
    const p = { BTC: res.data.bitcoin.usd, ETH: res.data.ethereum.usd, SOL: res.data.solana.usd, BNB: res.data.binancecoin.usd };
    const levels = { BTC: 5000, ETH: 500, SOL: 10, BNB: 50 };
    for (const asset in levels) {
      const current = p[asset];
      const previous = lastPrices[asset.toLowerCase()] || 0;
      if (previous > 0 && Math.floor(current / levels[asset]) !== Math.floor(previous / levels[asset])) {
        const target = Math.floor(current / levels[asset]) * levels[asset];
        await axios.post(process.env.WEBHOOK_ALERTS, {
          username: "OASIS | Price Watchdog", avatar_url: BOT_AVATAR,
          embeds: [{ title: `⚡ PSYCHOLOGICAL LEVEL: ${asset}`, description: `**${asset}** crossed **$${target.toLocaleString()}**.\nPrice: **$${current.toLocaleString()}**`, color: current > previous ? 3066993 : 15158332, footer: { text: ALERT_FOOTER } }]
        });
      }
      lastPrices[asset.toLowerCase()] = current;
    }
  } catch (e) {}
};

const runMarketDesk = async (isOpen) => {
  try {
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Fetch DXY, 10Y Yield, S&P 500, Gold, Silver." }] }],
      systemInstruction: { parts: [{ text: "Format: ▪️ **Asset**\n 🔹 Level: [Val] [Emoji]\n 🔹 24h: [Val] [Emoji]" }] }, tools: [{ "google_search": {} }]
    });
    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      await axios.post(process.env.WEBHOOK_MARKET, { username: "OASIS | Market Desk", avatar_url: BOT_AVATAR, embeds: [{ title: isOpen ? "🔔 NYSE OPEN" : "🌆 NYSE CLOSE", description: text, color: 16777215, footer: { text: "Market Settlement • Oasis Terminal" } }] });
    }
  } catch (e) {}
};

// --- SCHEDULES (UTC) ---
cron.schedule('*/5 * * * *', runRealTimeEngine);
cron.schedule('0 */4 * * *', runLiquidationWatch); // Every 4 hours
cron.schedule('*/15 * * * *', runPriceWatchdog);
cron.schedule('30 13 * * 1-5', runMorningBrief);
cron.schedule('30 14 * * 1-5', () => runMarketDesk(true));
cron.schedule('0 21 * * 1-5', () => runMarketDesk(false));
cron.schedule('0 19 * * 0', runWeeklyWrap);

app.listen(port, () => console.log(`Oasis Terminal v3.0 Running`));

// --- MANUAL TEST ROUTE ---
app.get('/test-liq', async (req, res) => {
    await runLiquidationWatch();
    res.send("Liquidation tracker triggered. Check Discord.");
});
