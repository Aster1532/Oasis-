const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

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
const ACADEMY_FOOTER = "Oasis Academy • Institutional Education";

// --- STATE MANAGEMENT ---
let sentHistory = [];
let weeklyMemory = []; 
let narrativeMemory = [];
let lastPrices = { bitcoin: 0, ethereum: 0, solana: 0, binancecoin: 0, gold: 0, silver: 0 };

// --- COMMAND CENTER (Root Route) ---
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; padding: 20px; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px; margin-top: 50px;">
      <h2 style="color: #333;">Oasis Terminal v3.8</h2>
      <p><strong>Command Center:</strong> Click to manually trigger Discord alerts.</p>
      <hr>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <a style="padding: 10px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; text-align: center;" href="/test-brief">Morning Brief</a>
        <a style="padding: 10px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; text-align: center;" href="/test-london">London Recap</a>
        <a style="padding: 10px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; text-align: center;" href="/test-watchdog">Price Watchdog</a>
        <a style="padding: 10px; background: #17a2b8; color: white; text-decoration: none; border-radius: 5px; text-align: center;" href="/test-knowledge">Knowledge Drop</a>
        <a style="padding: 10px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px; text-align: center;" href="/test-liq">Liquidation tracker</a>
        <a style="padding: 10px; background: #6c757d; color: white; text-decoration: none; border-radius: 5px; text-align: center;" href="/test-sentiment">Fear & Greed</a>
        <a style="padding: 10px; background: #343a40; color: white; text-decoration: none; border-radius: 5px; text-align: center;" href="/test-wrap">Weekly Wrap</a>
      </div>
      <hr>
      <p style="font-size: 0.8em; color: #666;">System Status: 🟢 Operational | Node-Cron Active</p>
    </div>
  `);
});

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
        
        const cryptoTerms = /(Bitcoin|BTC|ETH|Ethereum|Solana|SOL|XRP|Ripple|Binance|BNB|ETF|SATS|Stablecoin|Tether|USDC|Coinbase|Blockchain|Crypto|Altcoin)/i;
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
      }
    } catch (e) {}
  }
};

// --- MODULE 2: LIQUIDATION WATCH ---
const runLiquidationWatch = async () => {
  try {
    const prompt = `Analyze liquidations for BTC, ETH, SOL. Focus on Walls >$50M and Squeeze potential. No memecoins. Cold tone.`;
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Analyze liquidations" }] }], systemInstruction: { parts: [{ text: prompt }] }, tools: [{ "google_search": {} }]
    });
    const content = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (content) {
      await axios.post(process.env.WEBHOOK_LIQUIDATIONS, { username: "OASIS | Liquidity Tracker", avatar_url: BOT_AVATAR, embeds: [{ title: "🔥 LIQUIDATION & WHALE TRACKER", description: content, color: 15158332, footer: { text: LIQ_FOOTER } }] });
    }
  } catch (e) {}
};

// --- MODULE 3: WEEKLY WRAP ---
const runWeeklyWrap = async () => {
  if (weeklyMemory.length < 3) return;
  try {
    const titles = weeklyMemory.map(i => i.title).join("\n");
    const prompt = `Senior Analyst summary with bold theme headers. Headlines:\n${titles}`;
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, { contents: [{ parts: [{ text: "Weekly overview" }] }], systemInstruction: { parts: [{ text: prompt }] } });
    const summary = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    const primarySources = weeklyMemory.slice(-5).map(i => `• [${i.title}](${i.link})`).join("\n");
    if (summary) {
      await axios.post(process.env.WEBHOOK_WEEKLY, { username: "OASIS | Reports", avatar_url: BOT_AVATAR, embeds: [{ title: "🗞️ MARKET OVERVIEW", description: `**Summary:**\n${summary}\n\n**Primary Source:**\n${primarySources}`, color: 16777215, image: { url: WEEKLY_HEADER_IMG }, footer: { text: WEEKLY_FOOTER } }] });
    }
  } catch (e) {}
};

// --- MODULE 4: MORNING BRIEF ---
const runMorningBrief = async () => {
  try {
    const context = narrativeMemory.length > 0 ? narrativeMemory.slice(-20).join(". ") : "Markets entering high-volatility session.";
    const prompt = `Morning Brief: Danger Zone, ETF Flows, Narrative Bias. Context: ${context}.`;
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Morning Brief" }] }], systemInstruction: { parts: [{ text: prompt }] }, tools: [{ "google_search": {} }]
    });
    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      await axios.post(process.env.WEBHOOK_MARKET, { username: "OASIS | Intelligence", avatar_url: BOT_AVATAR, embeds: [{ title: "🌅 OASIS MORNING BRIEF", description: text, color: 16777215, footer: { text: BRIEF_FOOTER } }] });
    }
  } catch (e) {}
};

// --- MODULE 5: LONDON HANDOVER ---
const runLondonHandover = async () => {
  try {
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "London Recap" }] }], systemInstruction: { parts: [{ text: "3 bullets on FX and BTC price action." }] }, tools: [{ "google_search": {} }]
    });
    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      await axios.post(process.env.WEBHOOK_MARKET, { username: "OASIS | Session Desk", avatar_url: BOT_AVATAR, embeds: [{ title: "🇬🇧 LONDON SESSION HANDOVER", description: text, color: 16777215, footer: { text: LONDON_FOOTER } }] });
    }
  } catch (e) {}
};

// --- MODULE 6: KNOWLEDGE DROP (Redirected to ACADEMY) ---
const runKnowledgeDrop = async () => {
  console.log('📖 Generating Knowledge Drop...');
  try {
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Institutional trading term" }] }], systemInstruction: { parts: [{ text: "Explain a professional concept in 2 sentences." }] }
    });
    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      // Use Academy Webhook, fallback to Macro if not set
      const academyWebhook = process.env.WEBHOOK_ACADEMY || process.env.WEBHOOK_MACRO;
      await axios.post(academyWebhook, { 
        username: "OASIS | Academy", 
        avatar_url: BOT_AVATAR, 
        embeds: [{ 
          title: "📖 KNOWLEDGE DROP", 
          description: text, 
          color: 16777215, 
          footer: { text: ACADEMY_FOOTER } 
        }] 
      });
    }
  } catch (e) {}
};

// --- MODULE 7: PRICE WATCHDOG ---
const runPriceWatchdog = async (isTest = false) => {
  try {
    const res = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd");
    let p = { BTC: res.data.bitcoin.usd, ETH: res.data.ethereum.usd, SOL: res.data.solana.usd, BNB: res.data.binancecoin.usd };
    if (isTest) { lastPrices = { bitcoin: 99000, ethereum: 2900, solana: 195, binancecoin: 590 }; p.BTC = 100500; }
    const levels = { BTC: 5000, ETH: 500, SOL: 10, BNB: 50 };
    for (const asset in levels) {
      const current = p[asset];
      const previous = lastPrices[asset === 'BNB' ? 'binancecoin' : asset.toLowerCase()] || 0;
      if (previous > 0 && Math.floor(current / levels[asset]) !== Math.floor(previous / levels[asset])) {
        const target = Math.floor(current / levels[asset]) * levels[asset];
        await axios.post(process.env.WEBHOOK_ALERTS, {
          username: "OASIS | Price Watchdog", avatar_url: BOT_AVATAR,
          embeds: [{ title: `⚡ PSYCHOLOGICAL LEVEL: ${asset}`, description: `**${asset}** crossed **$${target.toLocaleString()}**.\nPrice: **$${current.toLocaleString()}**`, color: current > previous ? 3066993 : 15158332, footer: { text: ALERT_FOOTER } }]
        });
      }
      if (!isTest) lastPrices[asset === 'BNB' ? 'binancecoin' : asset.toLowerCase()] = current;
    }
  } catch (e) {}
};

// --- MODULE 8: MARKET DESK ---
const runMarketDesk = async (isOpen) => {
  try {
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "DXY, 10Y, S&P 500, Gold, Silver" }] }], systemInstruction: { parts: [{ text: "Format: ▪️ Asset, Level, 24h Change" }] }, tools: [{ "google_search": {} }]
    });
    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) { await axios.post(process.env.WEBHOOK_MARKET, { username: "OASIS | Market Desk", avatar_url: BOT_AVATAR, embeds: [{ title: isOpen ? "🔔 NYSE OPEN" : "🌆 NYSE CLOSE", description: text, color: 16777215, footer: { text: "Market Settlement • Oasis Terminal" } }] }); }
  } catch (e) {}
};

// --- MODULE 9: FEAR & GREED ---
const runFearGreed = async () => {
  try {
    const imageUrl = `https://alternative.me/crypto/fear-and-greed-index.png?t=${Date.now()}`;
    const target = process.env.WEBHOOK_SNAPSHOTS || process.env.WEBHOOK_MARKET;
    await axios.post(target, { username: "OASIS | Sentiment", avatar_url: BOT_AVATAR, embeds: [{ title: "", color: 16777215, image: { url: imageUrl }, footer: { text: SENTIMENT_FOOTER } }] });
  } catch (e) {}
};

// --- SCHEDULES ---
cron.schedule('*/5 * * * *', runRealTimeEngine);
cron.schedule('0 */4 * * *', runLiquidationWatch);
cron.schedule('*/15 * * * *', () => runPriceWatchdog(false));
cron.schedule('0 0,12 * * *', runKnowledgeDrop);
cron.schedule('0 12 * * 1-5', runLondonHandover);
cron.schedule('30 13 * * 1-5', runMorningBrief);
cron.schedule('30 14 * * 1-5', () => runMarketDesk(true));
cron.schedule('0 21 * * 1-5', () => runMarketDesk(false));
cron.schedule('0 8 * * *', runFearGreed);
cron.schedule('0 19 * * 0', async () => { await runWeeklyWrap(); weeklyMemory = []; });

app.listen(port, () => console.log(`Oasis Terminal v3.8 Operational`));

// --- TEST ROUTES ---
app.get('/test-brief', async (req, res) => { await runMorningBrief(); res.send("Brief Sent"); });
app.get('/test-london', async (req, res) => { await runLondonHandover(); res.send("London Sent"); });
app.get('/test-watchdog', async (req, res) => { await runPriceWatchdog(true); res.send("Watchdog Alert Sent"); });
app.get('/test-knowledge', async (req, res) => { await runKnowledgeDrop(); res.send("Knowledge Drop Sent (Check Academy/Macro)"); });
app.get('/test-liq', async (req, res) => { await runLiquidationWatch(); res.send("Liquidation Sent"); });
app.get('/test-sentiment', async (req, res) => { await runFearGreed(); res.send("Sentiment Sent"); });
app.get('/test-wrap', async (req, res) => { weeklyMemory = [{title:"Test Alpha",link:"#"},{title:"Test Macro",link:"#"}]; await runWeeklyWrap(); res.send("Wrap Sent"); });
