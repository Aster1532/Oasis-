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

const parser = new Parser();

// --- CONFIGURATION ---
const RSS_FEEDS = [
  "https://cointelegraph.com/rss", 
  "https://cryptopanic.com/news/rss/",
  "https://www.cnbc.com/id/10000664/device/rss/rss.html",
  "https://feeds.feedburner.com/coindesk"
];

// Memory Storage
let sentHistory = [];
let weeklyMemory = [];

// --- MODULE 1: REAL-TIME ENGINE ---
const runRealTimeEngine = async () => {
  console.log('🔍 Scanning Global Feeds...');
  
  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      
      for (const item of feed.items.slice(0, 10)) {
        if (sentHistory.includes(item.link)) continue;

        const headline = item.title || "";
        const cleanDesc = (item.contentSnippet || item.content || "").replace(/<[^>]*>?/gm, '').trim().substring(0, 450);
        
        // FILTERS
        const isMacro = /(FED|CPI|Inflation|Rates|FOMC|Powell|Recession|Hike|Cut|GDP|Treasury|NFP|BRICS|DXY|De-dollarization|Federal Reserve|Gold|Silver|Central Bank|ECB|Debt|Yield|War|Conflict|Oil|Energy)/i.test(headline);
        const isCrypto = /(ETF|SEC|BlackRock|Binance|Gensler|Regulation|Bitcoin|BTC|ETH|Ethereum|Whale|Liquidity|Halving|XRP|Ripple|Inflow|Outflow|Stablecoin|MicroStrategy|Tether|USDC|Coinbase|Institutional)/i.test(headline);

        const bullish = /(Cut|Approval|Pump|Green|Bull|Rally|ETF|Adoption|Inflow|Gains|Record|Breakout|Whale Buy)/i.test(headline);
        const color = bullish ? 3066993 : 15158332;

        // ROUTING
        if (isMacro || isCrypto) {
          const config = isMacro ? {
            webhook: process.env.WEBHOOK_MACRO,
            name: "OASIS | Macro Terminal",
            footer: "Source: Institutional Macro Feed • Oasis Terminal",
            ping: process.env.ROLE_ID_MACRO,
            avatar: "https://raw.githubusercontent.com/Aster1532/Bot-assets/refs/heads/main/1405.i012.002.S.m003.c11.network_globe.jpg"
          } : {
            webhook: process.env.WEBHOOK_CRYPTO,
            name: "OASIS | Crypto Intel",
            footer: "Alpha News Feed • Oasis Terminal",
            ping: process.env.ROLE_ID_ALPHA,
            avatar: "https://raw.githubusercontent.com/Aster1532/Bot-assets/refs/heads/main/Picsart_25-12-22_22-08-38-462.jpg"
          };

          await axios.post(config.webhook, {
            username: config.name,
            avatar_url: config.avatar,
            content: `<@&${config.ping}>`,
            embeds: [{
              title: `🚨 ${headline}`,
              description: cleanDesc || "View full report via source.",
              url: item.link,
              color: color,
              footer: { text: config.footer }
            }]
          });

          // Save for Weekly Wrap
          weeklyMemory.push({ title: headline, link: item.link });
        }

        sentHistory.push(item.link);
        if (sentHistory.length > 500) sentHistory.shift();
      }
    } catch (e) { console.log(`Feed Error: ${feedUrl}`); }
  }
};

// --- MODULE 2: MARKET DESK ---
const runMarketDesk = async (isOpen) => {
  console.log('📈 Running Market Desk...');
  try {
    const prompt = `You are a raw data terminal. Output ONLY data in this EXACT format:
▪️ **[Asset Name]**
  🔹 Level: [Value] [Emoji]
  🔹 24h Change: [Value] [Emoji]
Rules: Asset Name bold. Sub-points blue diamond. Emoji (📈/📉/🛡️) AFTER value. No headers.
Assets: DXY (Dollar Index), US 10Y Treasury Yield, S&P 500 Index.`;

    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: "Fetch market data" }] }], systemInstruction: { parts: [{ text: prompt }] }, tools: [{ "google_search": {} }] }
    );

    let data = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (data) {
      data = data.replace(/ASTER \| Market desk snapshot/gi, '').replace(/Here is/gi, '').trim();
      const title = isOpen ? "🔔 NYSE SESSION OPEN" : "🌆 NYSE SESSION CLOSE";
      const footer = isOpen ? "Monitoring Session Volatility" : "Daily Settlement Complete";

      await axios.post(process.env.WEBHOOK_MARKET, {
        username: "OASIS | Market Desk",
        avatar_url: "https://raw.githubusercontent.com/Aster1532/Bot-assets/refs/heads/main/Picsart_26-01-04_00-27-24-969.jpg",
        embeds: [{
          title: title,
          description: data,
          color: 16777215,
          footer: { text: `Oasis Market Desk • ${footer}` },
          timestamp: new Date()
        }]
      });
    }
  } catch (e) { console.error("Market Desk Error"); }
};

// --- MODULE 3: WEEKLY WRAP ---
const runWeeklyWrap = async () => {
  console.log('🗞️ Running Weekly Wrap...');
  if (weeklyMemory.length === 0) return;

  const titles = weeklyMemory.map(i => i.title).join("\n");
  let summary = "*Summary currently unavailable.*";

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: `Headlines:\n${titles}` }] }], systemInstruction: { parts: [{ text: "Summarize into 3 professional bullets. No intro." }] } }
    );
    summary = res.data.candidates?.[0]?.content?.parts?.[0]?.text || summary;
  } catch (e) {}

  let listText = weeklyMemory.slice(-15).map(i => `• [${i.title}](${i.link})`).join("\n");
  
  await axios.post(process.env.WEBHOOK_WEEKLY, {
    username: "OASIS | Reports",
    avatar_url: "https://raw.githubusercontent.com/Aster1532/Bot-assets/refs/heads/main/Picsart_26-01-04_00-27-24-969.jpg",
    embeds: [{
      title: "🗞️ MARKET OVERVIEW",
      description: `**Summary:**\n${summary}\n\n**Primary Source:**\n${listText}`,
      color: 16777215,
      image: { url: "https://raw.githubusercontent.com/Aster1532/Bot-assets/refs/heads/main/Picsart_25-12-24_19-16-44-741.jpg" },
      footer: { text: "The Most Important Only • Oasis Terminal" }
    }]
  });
  weeklyMemory = [];
};

// --- SCHEDULES ---
cron.schedule('*/5 * * * *', runRealTimeEngine);
cron.schedule('30 14 * * 1-5', () => runMarketDesk(true));
cron.schedule('0 21 * * 1-5', () => runMarketDesk(false));
cron.schedule('0 19 * * 0', runWeeklyWrap);



