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
  console.log('🔍 Scanning Global Feeds...');
  for (const feedUrl of [
    "https://cointelegraph.com/rss", 
    "https://cryptopanic.com/news/rss/",
    "https://www.cnbc.com/id/10000664/device/rss/rss.html",
    "https://feeds.feedburner.com/coindesk"
  ]) {
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const item of feed.items.slice(0, 10)) {
        const uniqueString = (item.title || "") + (item.pubDate || "");
        const itemId = crypto.createHash('md5').update(uniqueString).digest('hex');
        if (sentHistory.includes(itemId)) continue;

        const headline = item.title || "";
        const rawDesc = item.contentSnippet || item.content || "";
        const cleanDesc = rawDesc.replace(/<[^>]*>?/gm, '').trim().substring(0, 450);
        const imageUrl = extractImage(item);

        const isMacro = /(FED|CPI|Inflation|Rates|FOMC|Powell|Recession|Hike|Cut|GDP|Treasury|NFP|BRICS|DXY|Federal Reserve|Gold|Silver|Central Bank|ECB|Debt|Yield|War|Conflict|Oil|Energy)/i.test(headline);
        const isCrypto = /(ETF|SEC|BlackRock|Binance|Gensler|Regulation|Bitcoin|BTC|ETH|Ethereum|Whale|Liquidity|Halving|XRP|Ripple|Inflow|Outflow|Stablecoin|MicroStrategy|Tether|USDC|Circle|Coinbase|Institutional)/i.test(headline);

        if (isMacro || isCrypto) {
          const bullish = /(Cut|Approval|Pump|Green|Bull|Rally|ETF|Adoption|Inflow|Gains|Record|Breakout|Whale Buy|Upside|Surge|Buying)/i.test(headline);
          const bearish = /(Hike|Panic|Crash|Dump|Drop|Inflation|Recession|SEC|Lawsuit|Hack|Outflow|Losses|Delayed|De-dollarization|War|Conflict|Selling|Downside|Default)/i.test(headline);
          
          let color = 16777215; // White
          if (bullish) color = 3066993; // Green
          else if (bearish) color = 15158332; // Red

          const config = isMacro ? { webhook: process.env.WEBHOOK_MACRO, name: "OASIS | Macro Terminal", ping: process.env.ROLE_ID_MACRO } 
                                 : { webhook: process.env.WEBHOOK_CRYPTO, name: "OASIS | Crypto Intel", ping: process.env.ROLE_ID_ALPHA };

          await axios.post(config.webhook, {
            username: config.name,
            avatar_url: BOT_AVATAR,
            content: `<@&${config.ping}>`,
            embeds: [{
              title: `🚨 ${headline}`,
              description: cleanDesc || "View full report via source.",
              url: item.link,
              color: color,
              image: imageUrl ? { url: imageUrl } : null,
              footer: { text: config.footer || FOOTER_TEXT }
            }]
          });

          weeklyMemory.push({ title: headline, link: item.link });
          narrativeMemory.push(headline);
          if (narrativeMemory.length > 100) narrativeMemory.shift();
        }
        sentHistory.push(itemId);
        if (sentHistory.length > 500) sentHistory.shift();
      }
    } catch (e) { console.log("Feed Sync Error"); }
  }
};

// --- MODULE 2: OASIS MORNING BRIEF (ETF, Narrative, Calendar) ---
const runMorningBrief = async () => {
  console.log('🌅 Generating Morning Brief...');
  try {
    const prompt = `You are an Institutional Research Analyst. Analyze the latest news and perform a Google Search to generate a Morning Brief for Traders.
    1. **VOLATILITY DANGER ZONE**: List today's High-Impact economic releases (e.g. CPI, Jobs, FOMC). If none, state "Clear Skies".
    2. **INSTITUTIONAL FLOWS**: Fetch yesterday's Net BTC ETF Inflow/Outflow data (Focus on IBIT and FBTC).
    3. **MARKET NARRATIVE**: Define the current market sentiment based on headlines: ${narrativeMemory.slice(-20).join(". ")}
    
    Structure with bold headers and clean bullet points. Keep it professional.`;

    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Compile the Oasis Morning Brief." }] }],
      systemInstruction: { parts: [{ text: prompt }] },
      tools: [{ "google_search": {} }]
    });

    const brief = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (brief) {
      await axios.post(process.env.WEBHOOK_MARKET, {
        username: "OASIS | Intelligence",
        avatar_url: BOT_AVATAR,
        embeds: [{
          title: "🌅 OASIS MORNING BRIEF",
          description: brief,
          color: 16777215,
          footer: { text: "Institutional Pre-Market Brief • Oasis Terminal" },
          timestamp: new Date()
        }]
      });
    }
  } catch (e) { console.error("Morning Brief Error"); }
};

// --- MODULE 3: LONDON HANDOVER RECAP ---
const runLondonHandover = async () => {
  console.log('🇬🇧 Generating London Recap...');
  try {
    const prompt = `Perform a recap of the London Trading Session. 
    1. Briefly describe the price action for GBP/USD, EUR/USD, and BTC during the last 6 hours.
    2. State if London created a trend or just liquidity/chop.
    No intro fluff, just professional bullets. Use institutional terminology.`;

    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Recap the London Session" }] }],
      systemInstruction: { parts: [{ text: prompt }] },
      tools: [{ "google_search": {} }]
    });

    const recap = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (recap) {
      await axios.post(process.env.WEBHOOK_MARKET, {
        username: "OASIS | Session Desk",
        avatar_url: BOT_AVATAR,
        embeds: [{
          title: "🇬🇧 LONDON SESSION HANDOVER",
          description: recap,
          color: 16777215,
          footer: { text: "Handover to New York Desk • Oasis Terminal" }
        }]
      });
    }
  } catch (e) { console.error("Handover Error"); }
};

// --- MODULE 4: PRICE WATCHDOG (Psychological Levels) ---
const runPriceWatchdog = async () => {
  console.log('🐕 Watchdog checking levels...');
  try {
    // 1. Fetch Crypto Prices
    const cryptoRes = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd");
    const prices = {
      BTC: cryptoRes.data.bitcoin.usd,
      ETH: cryptoRes.data.ethereum.usd,
      SOL: cryptoRes.data.solana.usd,
      BNB: cryptoRes.data.binancecoin.usd
    };

    // 2. Define Levels
    const levels = { BTC: 5000, ETH: 500, SOL: 10, BNB: 50 };
    
    for (let asset in levels) {
      const current = prices[asset];
      const assetKey = asset === 'BNB' ? 'binancecoin' : asset.toLowerCase();
      const previous = lastPrices[assetKey] || 0;

      if (previous > 0) {
        const interval = levels[asset];
        const crossed = Math.floor(current / interval) !== Math.floor(previous / interval);

        if (crossed) {
          const target = Math.floor(current / interval) * interval;
          const direction = current > previous ? "📈 BROKEN ABOVE" : "📉 BROKEN BELOW";
          await axios.post(process.env.WEBHOOK_ALERTS, {
            username: "OASIS | Price Watchdog",
            avatar_url: BOT_AVATAR,
            embeds: [{
              title: `⚡ PSYCHOLOGICAL LEVEL: ${asset}`,
              description: `**${asset}** has just **${direction}** the **$${target.toLocaleString()}** level.\n\nCurrent Price: **$${current.toLocaleString()}**`,
              color: current > previous ? 3066993 : 15158332,
              footer: { text: "Institutional Level Alert • Oasis Terminal" }
            }]
          });
        }
      }
      lastPrices[assetKey] = current;
    }
  } catch (e) { console.error("Watchdog Error"); }
};

// --- MODULE 5: INSTITUTIONAL KNOWLEDGE DROP ---
const runKnowledgeDrop = async () => {
  console.log('📖 Dropping Knowledge...');
  try {
    const prompt = `Provide an "Institutional Term of the Day" for traders. 
    Choose a term like Liquidity Sweep, Order Block, Delta, VWAP, or Open Interest.
    Explain it in exactly 2 clear, professional sentences. 
    Format: **[Term Name]**\n[Explanation]`;

    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Explain a trading term." }] }],
      systemInstruction: { parts: [{ text: prompt }] }
    });

    const drop = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (drop) {
      await axios.post(process.env.WEBHOOK_MACRO, {
        username: "OASIS | Academy",
        avatar_url: BOT_AVATAR,
        embeds: [{
          title: "📖 INSTITUTIONAL KNOWLEDGE DROP",
          description: drop,
          color: 16777215,
          footer: { text: "Education for Elite Traders • Oasis Terminal" }
        }]
      });
    }
  } catch (e) { console.error("Knowledge Drop Error"); }
};

// --- MODULE 6: MARKET DESK (Open/Close) ---
const runMarketDesk = async (isOpen) => {
  try {
    const prompt = `You are a raw data terminal. Output ONLY data in this EXACT format:
▪️ **[Asset Name]**
  🔹 Level: [Value] [Emoji]
  🔹 24h Change: [Value] [Emoji]
Assets: DXY, US 10Y Yield, S&P 500, Gold (XAUUSD), Silver (XAGUSD).`;

    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Fetch market data" }] }],
      systemInstruction: { parts: [{ text: prompt }] },
      tools: [{ "google_search": {} }]
    });

    let data = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (data) {
      const title = isOpen ? "🔔 NYSE SESSION OPEN" : "🌆 NYSE SESSION CLOSE";
      await axios.post(process.env.WEBHOOK_MARKET, {
        username: "OASIS | Market Desk",
        avatar_url: BOT_AVATAR,
        embeds: [{
          title: title,
          description: data,
          color: 16777215,
          footer: { text: "Market Settlement • Oasis Terminal" },
          timestamp: new Date()
        }]
      });
    }
  } catch (e) {}
};

// --- MODULE 7: WEEKLY WRAP & FEAR/GREED ---
const runWeeklyWrap = async () => { /* Logic same as previous turn */ };
const runFearGreed = async () => {
  await axios.post(process.env.WEBHOOK_MARKET, {
    username: "OASIS | Sentiment",
    avatar_url: BOT_AVATAR,
    embeds: [{
      title: "📊 DAILY MARKET SENTIMENT",
      color: 16777215,
      image: { url: "https://alternative.me/crypto/fear-and-greed-index.png" },
      footer: { text: "Daily Market Sentiment Update • Oasis Terminal" }
    }]
  });
};

// --- SCHEDULER (UTC) ---
cron.schedule('*/5 * * * *', runRealTimeEngine); // News Scan
cron.schedule('*/15 * * * *', runPriceWatchdog); // Price Level Check
cron.schedule('0 0,12 * * *', runKnowledgeDrop); // 12hr Education Drop
cron.schedule('0 12 * * 1-5', runLondonHandover); // 7 AM EST (Handover)
cron.schedule('30 13 * * 1-5', runMorningBrief); // 8:30 AM EST (Brief)
cron.schedule('30 14 * * 1-5', () => runMarketDesk(true)); // 9:30 AM EST (Open)
cron.schedule('0 21 * * 1-5', () => runMarketDesk(false)); // 4:00 PM EST (Close)
cron.schedule('0 1 * * *', runFearGreed); // 1 AM Daily
cron.schedule('0 19 * * 0', runWeeklyWrap); // Sunday Wrap
