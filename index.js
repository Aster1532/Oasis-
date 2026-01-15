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
const GEM_FOOTER = "Early Stage Alpha • Oasis Terminal"; // Added for Module 10
const WHALE_FOOTER = "Large Scale On-Chain Alert • Oasis Terminal"; // Added for Module 11

// --- STATE MANAGEMENT ---
let sentHistory = []; // Stores normalized titles to prevent duplicates
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

// --- MODULE 1: REAL-TIME ENGINE (Strict Routing + Duplicate Fix) ---
const runRealTimeEngine = async () => {
  console.log('🔍 Scanning Global Feeds...');
  const feeds = [
    "https://cointelegraph.com/rss", 
    "https://cryptopanic.com/news/rss/", 
    "https://www.cnbc.com/id/10000664/device/rss/rss.html", 
    "https://feeds.feedburner.com/coindesk"
  ];
  
  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items.slice(0, 10)) {
        const headline = item.title || "";
        
        // DUPLICATE FIX: Normalize title (lowercase, no spaces/specials)
        const cleanTitle = headline.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (sentHistory.includes(cleanTitle)) continue;

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
            username: config.name, 
            avatar_url: BOT_AVATAR, 
            content: `<@&${config.ping}>`,
            embeds: [{ 
                title: `🚨 ${headline}`, 
                description: (item.contentSnippet || "").substring(0, 400), 
                url: item.link, 
                color: color, 
                image: extractImage(item) ? { url: extractImage(item) } : null, 
                footer: { text: config.footer } 
            }]
          });
          
          weeklyMemory.push({ title: headline, link: item.link });
          narrativeMemory.push(headline);
          if (narrativeMemory.length > 50) narrativeMemory.shift();
        }
        
        sentHistory.push(cleanTitle);
        if (sentHistory.length > 500) sentHistory.shift();
      }
    } catch (e) {}
  }
};

// --- MODULE 2: MARKET DESK (Fixed Strict Format) ---
const runMarketDesk = async (isOpen) => {
  console.log(`🔔 Triggering Market Desk: ${isOpen ? 'Open' : 'Close'}`);
  try {
    const prompt = `You are a raw data terminal. Output ONLY the data in this EXACT format. Do not add intro/outro text.
    
    Topic: ${isOpen ? "🔔 NYSE SESSION OPEN" : "🌆 NYSE SESSION CLOSE"}

    • **DXY (Dollar Index)**
        • Level: [Value] [Emoji]
        • 24h Change: [Value]
    • **US 10Y Treasury Yield**
        • Level: [Value] [Emoji]
        • 24h Change: [Value]
    • **S&P 500 Index**
        • Level: [Value] [Emoji]
        • 24h Change: [Value]
    
    Emoji Rules: 
    - Use 📈 for up, 📉 for down, 🛡️ for flat.
    - Place emoji AFTER "Level".
    - DO NOT place any emoji after "24h Change".`;

    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Fetch current market data for DXY, US10Y, and SPX." }] }],
      systemInstruction: { parts: [{ text: prompt }] },
      tools: [{ "google_search": {} }]
    });

    const data = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (data) {
      await axios.post(process.env.WEBHOOK_MARKET, {
        username: "OASIS | Market Desk",
        avatar_url: BOT_AVATAR,
        embeds: [{
          title: isOpen ? "🔔 NYSE SESSION OPEN" : "🌆 NYSE SESSION CLOSE",
          description: data.replace(/Topic:.*\n/g, "").trim(),
          color: 16777215,
          footer: { text: "Market Settlement • Oasis Terminal" },
          timestamp: new Date()
        }]
      });
    }
  } catch (e) { console.error("Market Desk Error", e.message); }
};

// --- MODULE 3: LIQUIDATION WATCH (BTC/ETH/SOL ONLY) ---
const runLiquidationWatch = async () => {
  console.log('💥 Scanning for Major Liquidations...');
  try {
    const prompt = `You are a Risk Manager. Search Liquidation Heatmaps (last 24h). Report ONLY on **BTC, ETH, and SOL**. Ignore all memecoins/low-caps. 1. **MAJOR WALLS**: Where is >$50M liquidity sitting? 2. **WHALE ACTIVITY**: Largest single liquidation for BTC/ETH/SOL only. 3. **RISK**: "Long Squeeze" or "Short Squeeze"? Format: Clean bullets. Institutional tone. No intro.`;
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, { 
        contents: [{ parts: [{ text: "Analyze Liquidations for BTC/ETH/SOL." }] }], 
        systemInstruction: { parts: [{ text: prompt }] }, 
        tools: [{ "google_search": {} }] 
    });
    const analysis = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (analysis) {
      await axios.post(process.env.WEBHOOK_LIQUIDATIONS, { 
          username: "OASIS | Liquidity Tracker", 
          avatar_url: BOT_AVATAR, 
          embeds: [{ title: "🔥 LIQUIDATION & WHALE TRACKER", description: analysis, color: 15158332, footer: { text: LIQ_FOOTER } }] 
      });
    }
  } catch (e) { console.error("Liquidation Watch Error:", e.message); }
};

// --- MODULE 4: WEEKLY WRAP (The Sunday Report) ---
const runWeeklyWrap = async () => {
  console.log('🗞️ Generating Weekly Wrap...');
  if (weeklyMemory.length < 5) return;
  try {
    const titles = weeklyMemory.map(i => i.title).join("\n");
    const prompt = `Senior Institutional Analyst. Generate 3-bullet summary with bold headers theme. Headlines:\n${titles}`;
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, { 
        contents: [{ parts: [{ text: "Generate the Weekly Market Overview." }] }], 
        systemInstruction: { parts: [{ text: prompt }] } 
    });
    const summary = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    const primarySources = weeklyMemory.slice(-5).map(i => `• [${i.title}](${i.link})`).join("\n");
    if (summary) {
      await axios.post(process.env.WEBHOOK_WEEKLY, { 
          username: "OASIS | Reports", 
          avatar_url: BOT_AVATAR, 
          embeds: [{ title: "🗞️ MARKET OVERVIEW", description: `**Summary:**\n${summary}\n\n**Primary Source:**\n${primarySources}`, color: 16777215, image: { url: WEEKLY_HEADER_IMG }, footer: { text: WEEKLY_FOOTER } }] 
      });
    }
    weeklyMemory = [];
  } catch (e) { console.error("Weekly Wrap Error:", e.message); }
};

// --- MODULE 5: MORNING BRIEF ---
const runMorningBrief = async () => {
    console.log('🌅 Generating Morning Brief...');
    try {
        const prompt = `Senior Analyst. Generate Brief: 1. VOLATILITY DANGER ZONE. 2. INSTITUTIONAL FLOWS (BTC ETF data). 3. NARRATIVE. Use professional bullets. Headlines: ${narrativeMemory.slice(-20).join(". ")}`;
        const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          contents: [{ parts: [{ text: "Create Morning Brief" }] }], systemInstruction: { parts: [{ text: prompt }] }, tools: [{ "google_search": {} }]
        });
        const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
            await axios.post(process.env.WEBHOOK_MARKET, { 
                username: "OASIS | Intelligence", 
                avatar_url: BOT_AVATAR, 
                embeds: [{ title: "🌅 OASIS MORNING BRIEF", description: text, color: 16777215, footer: { text: BRIEF_FOOTER } }] 
            });
        }
    } catch (e) { console.error("Morning Brief Error:", e.message); }
};

// --- MODULE 6: PRICE WATCHDOG (Alerts) ---
const runPriceWatchdog = async () => {
  console.log('⚡ Checking Price Levels...');
  try {
    const res = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,gold,silver&vs_currencies=usd");
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
  } catch (e) { console.error("Watchdog Error:", e.message); }
};

// --- MODULE 7: SENTIMENT (Fear & Greed) ---
const runFearGreed = async () => {
  console.log('📊 Generating Sentiment Report...');
  try {
    const timestamp = new Date().getTime();
    const imageUrl = `https://alternative.me/crypto/fear-and-greed-index.png?t=${timestamp}`;
    const targetWebhook = process.env.WEBHOOK_SNAPSHOTS || process.env.WEBHOOK_MARKET;

    await axios.post(targetWebhook, {
      username: "OASIS | Sentiment",
      avatar_url: BOT_AVATAR,
      embeds: [{
        title: "",
        color: 16777215, 
        image: { url: imageUrl },
        footer: { text: SENTIMENT_FOOTER }
      }]
    });
  } catch (e) { console.error("Sentiment Error:", e.message); }
};

// --- MODULE 8: SESSION HANDOVER ---
const runLondonHandover = async () => {
  console.log('🇬🇧 Generating London Handover...');
  try {
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Recap London session focus on GBP, EUR, BTC." }] }], 
      systemInstruction: { parts: [{ text: "3 bullets. Institutional tone." }] }, tools: [{ "google_search": {} }]
    });
    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      await axios.post(process.env.WEBHOOK_MARKET, { username: "OASIS | Session Desk", avatar_url: BOT_AVATAR, embeds: [{ title: "🇬🇧 LONDON SESSION HANDOVER", description: text, color: 16777215, footer: { text: LONDON_FOOTER } }] });
    }
  } catch (e) {}
};

// --- MODULE 9: KNOWLEDGE DROP ---
const runKnowledgeDrop = async () => {
  console.log('📖 Generating Knowledge Drop...');
  try {
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Explain one institutional trading term in 2 sentences." }] }]
    });
    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      await axios.post(process.env.WEBHOOK_ACADEMY, { username: "OASIS | Academy", avatar_url: BOT_AVATAR, embeds: [{ title: "📖 KNOWLEDGE DROP", description: text, color: 16777215, footer: { text: "Education • Oasis Terminal" } }] });
    }
  } catch (e) {}
};

// --- MODULE 10: WHALE MOVEMENT ---
const runWhaleMovement = async () => {
  console.log('🐋 Scanning for Whale Transfers...');
  try {
    const prompt = `You are a Whale Tracker. Search for large crypto transfers (Last 2 hours) from Whale Alert or major explorers.
    Criteria:
    - BTC > 1,000 transferred
    - ETH > 10,000 transferred
    - SOL > 100,000 transferred
    
    Format:
    • **Asset**: [Amount] moved from [Wallet/Exchange] to [Wallet/Exchange].
    • **Implication**: (e.g. "Potential Dump" or "Accumulation").
    
    If no major moves found, output nothing.`;

    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, { contents: [{ parts: [{ text: "Scan for Whale Transfers." }] }], systemInstruction: { parts: [{ text: prompt }] }, tools: [{ "google_search": {} }] });
    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (text && text.length > 20) {
      await axios.post(process.env.WEBHOOK_WHALE, { 
          username: "OASIS | Whale Watch", 
          avatar_url: BOT_AVATAR, 
          embeds: [{ title: "🐋 WHALE MOVEMENT ALERT", description: text, color: 3066993, footer: { text: WHALE_FOOTER } }] 
      });
    }
  } catch (e) { console.error("Whale Move Error:", e.message); }
};

// --- SCHEDULES (UTC) ---
cron.schedule('*/5 * * * *', runRealTimeEngine);
cron.schedule('0 */4 * * *', runLiquidationWatch); // Liquidations
cron.schedule('0 */2 * * *', runWhaleMovement);    // Whale Moves
cron.schedule('*/15 * * * *', runPriceWatchdog);
cron.schedule('0 0,12 * * *', runKnowledgeDrop);
cron.schedule('0 12 * * 1-5', runLondonHandover);
cron.schedule('30 13 * * 1-5', runMorningBrief);
cron.schedule('30 14 * * 1-5', () => runMarketDesk(true));
cron.schedule('0 21 * * 1-5', () => runMarketDesk(false));
cron.schedule('0 6 * * *', runFearGreed);
cron.schedule('0 19 * * 0', async () => { await runWeeklyWrap(); weeklyMemory = []; });
cron.schedule('0 16 * * *', runAltcoinDiscovery);

app.listen(port, () => console.log(`Oasis Terminal v3.9 Fully Operational`));

// --- TEST ROUTES ---
app.get('/test-whale', async (req, res) => { await runWhaleMovement(); res.send("Whale Move Triggered"); });
app.get('/test-sentiment', async (req, res) => { await runFearGreed(); res.send("Sentiment Triggered"); });
app.get('/test-liq', async (req, res) => { await runLiquidationWatch(); res.send("Liquidation Triggered"); });
app.get('/test-wrap', async (req, res) => { weeklyMemory=[{title:"Test Headline",link:"#"}]; await runWeeklyWrap(); res.send("Wrap Triggered"); });
app.get('/test-desk', async (req, res) => { await runMarketDesk(true); res.send("Market Desk Open Triggered"); });
