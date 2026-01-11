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

// --- BRANDING ASSETS ---
const BOT_AVATAR = "https://github.com/Aster1532/Bot-assets/blob/main/Picsart_26-01-04_00-27-24-969.jpg?raw=true";

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

// --- MODULE 1: REAL-TIME ENGINE (Strict Routing) ---
const runRealTimeEngine = async () => {
  console.log('🔍 Scanning Global Feeds...');
  const feeds = ["https://cointelegraph.com/rss", "https://cryptopanic.com/news/rss/", "https://www.cnbc.com/id/10000664/device/rss/rss.html", "https://feeds.feedburner.com/coindesk"];
  
  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items.slice(0, 10)) {
        const hash = crypto.createHash('md5').update((item.title || "") + (item.pubDate || "")).digest('hex');
        if (sentHistory.includes(hash)) continue;

        const headline = item.title || "";
        const imageUrl = extractImage(item);
        const cleanDesc = (item.contentSnippet || "").replace(/<[^>]*>?/gm, '').trim().substring(0, 400);

        // REGEX DEFINITIONS
        const cryptoTerms = /(Bitcoin|BTC|ETH|Ethereum|Solana|SOL|XRP|Ripple|Binance|BNB|Cardano|ADA|Dogecoin|DOGE|Shiba|ETF|SATS|Stablecoin|Tether|USDC|Coinbase|Kraken|Gemini|Wallet|Blockchain|Crypto|Altcoin|Trillionaire)/i;
        const macroTerms = /(FED|CPI|Inflation|Rates|FOMC|Powell|Recession|Hike|Cut|GDP|Treasury|NFP|BRICS|DXY|Federal Reserve|Gold|Silver|Central Bank|ECB|Debt|Yield|War|Conflict|Oil|Energy)/i;

        let config = null;

        // RULE: Crypto terms ALWAYS go to Crypto channel, even if they mention Macro terms.
        if (cryptoTerms.test(headline)) {
          config = { 
            webhook: process.env.WEBHOOK_CRYPTO, 
            name: "OASIS | Crypto Intel", 
            ping: process.env.ROLE_ID_ALPHA, 
            footer: CRYPTO_FOOTER 
          };
        } 
        // RULE: Macro headlines MUST NOT contain any crypto words to be sent to Macro.
        else if (macroTerms.test(headline)) {
          config = { 
            webhook: process.env.WEBHOOK_MACRO, 
            name: "OASIS | Macro Terminal", 
            ping: process.env.ROLE_ID_MACRO, 
            footer: MACRO_FOOTER 
          };
        }

        if (config) {
          const bullish = /(Cut|Approval|Pump|Green|Bull|Rally|ETF|Adoption|Inflow|Gains|Record|Breakout|Whale Buy)/i.test(headline);
          const bearish = /(Hike|Panic|Crash|Dump|Drop|Inflation|Recession|SEC|Lawsuit|Hack|Outflow|Losses|War|Conflict)/i.test(headline);
          let color = 16777215; // White
          if (bullish) color = 3066993;
          else if (bearish) color = 15158332;

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
              footer: { text: config.footer }
            }]
          });
          weeklyMemory.push({ title: headline, link: item.link });
          narrativeMemory.push(headline);
          if (narrativeMemory.length > 50) narrativeMemory.shift();
        }
        sentHistory.push(hash);
        if (sentHistory.length > 500) sentHistory.shift();
      }
    } catch (e) {}
  }
};

// --- MODULE 2: MORNING BRIEF (8:30 AM EST) ---
const runMorningBrief = async () => {
  try {
    const prompt = `Senior Analyst. Generate Brief: 1. VOLATILITY DANGER ZONE (Red Folder Events). 2. INSTITUTIONAL FLOWS (BTC ETF IBIT/FBTC data). 3. NARRATIVE (Context: ${narrativeMemory.join(". ")}). Bold headers, professional bullets.`;
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Generate Brief." }] }], systemInstruction: { parts: [{ text: prompt }] }, tools: [{ "google_search": {} }]
    });
    const content = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (content) {
      await axios.post(process.env.WEBHOOK_MARKET, {
        username: "OASIS | Intelligence", avatar_url: BOT_AVATAR,
        embeds: [{ title: "🌅 OASIS MORNING BRIEF", description: content, color: 16777215, footer: { text: BRIEF_FOOTER } }]
      });
    }
  } catch (e) {}
};

// --- MODULE 3: SESSION RECAPS & KNOWLEDGE ---
const runLondonHandover = async () => {
  try {
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Recap London session focus on GBP, EUR, BTC." }] }], 
      systemInstruction: { parts: [{ text: "3 bullets. Institutional tone." }] }, tools: [{ "google_search": {} }]
    });
    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      await axios.post(process.env.WEBHOOK_MARKET, {
        username: "OASIS | Session Desk", avatar_url: BOT_AVATAR,
        embeds: [{ title: "🇬🇧 LONDON SESSION HANDOVER", description: text, color: 16777215, footer: { text: LONDON_FOOTER } }]
      });
    }
  } catch (e) {}
};

const runKnowledgeDrop = async () => {
  try {
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Explain one institutional trading term in 2 sentences." }] }]
    });
    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      await axios.post(process.env.WEBHOOK_MACRO, {
        username: "OASIS | Academy", avatar_url: BOT_AVATAR,
        embeds: [{ title: "📖 KNOWLEDGE DROP", description: text, color: 16777215, footer: { text: "Education • Oasis Terminal" } }]
      });
    }
  } catch (e) {}
};

// --- MODULE 4: WATCHDOG (Crypto & Forex Psych Levels) ---
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
          embeds: [{
            title: `⚡ PSYCHOLOGICAL LEVEL: ${asset}`,
            description: `**${asset}** crossed **$${target.toLocaleString()}**.\nPrice: **$${current.toLocaleString()}**`,
            color: current > previous ? 3066993 : 15158332, footer: { text: ALERT_FOOTER }
          }]
        });
      }
      lastPrices[asset.toLowerCase()] = current;
    }
  } catch (e) {}
};

// --- MODULE 5: MARKET SETTLEMENTS ---
const runMarketDesk = async (isOpen) => {
  try {
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Fetch DXY, 10Y Yield, S&P 500, Gold, Silver." }] }],
      systemInstruction: { parts: [{ text: "Format: ▪️ **Asset**\n 🔹 Level: [Val] [Emoji]\n 🔹 24h: [Val] [Emoji]" }] }, tools: [{ "google_search": {} }]
    });
    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      await axios.post(process.env.WEBHOOK_MARKET, {
        username: "OASIS | Market Desk", avatar_url: BOT_AVATAR,
        embeds: [{ title: isOpen ? "🔔 NYSE OPEN" : "🌆 NYSE CLOSE", description: text, color: 16777215, footer: { text: "Market Settlement • Oasis Terminal" } }]
      });
    }
  } catch (e) {}
};

// --- MODULE 6: WEEKLY WRAP & SENTIMENT ---
const runWeeklyWrap = async () => {
  if (weeklyMemory.length === 0) return;
  const list = weeklyMemory.slice(-15).map(i => `• [${i.title}](${i.link})`).join("\n");
  await axios.post(process.env.WEBHOOK_WEEKLY, {
    username: "OASIS | Reports", avatar_url: BOT_AVATAR,
    embeds: [{ title: "🗞️ WEEKLY SUMMARY", description: `**Primary Source:**\n${list}`, color: 16777215, footer: { text: WEEKLY_FOOTER } }]
  });
  weeklyMemory = [];
};

const runFearGreed = async () => {
  await axios.post(process.env.WEBHOOK_MARKET, {
    username: "OASIS | Sentiment", avatar_url: BOT_AVATAR,
    embeds: [{ title: "📊 DAILY MARKET SENTIMENT", image: { url: "https://alternative.me/crypto/fear-and-greed-index.png" }, footer: { text: SENTIMENT_FOOTER } }]
  });
};

// --- SCHEDULES (UTC) ---
cron.schedule('*/5 * * * *', runRealTimeEngine);
cron.schedule('*/15 * * * *', runPriceWatchdog);
cron.schedule('0 0,12 * * *', runKnowledgeDrop);
cron.schedule('0 12 * * 1-5', runLondonHandover);
cron.schedule('30 13 * * 1-5', runMorningBrief);
cron.schedule('30 14 * * 1-5', () => runMarketDesk(true));
cron.schedule('0 21 * * 1-5', () => runMarketDesk(false));
cron.schedule('0 1 * * *', runFearGreed);
cron.schedule('0 19 * * 0', runWeeklyWrap);

          
