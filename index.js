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
const WHALE_FOOTER = "Large Scale On-Chain Alert • Oasis Terminal";
const FOREX_FOOTER = "Institutional FX Strategy • Oasis Terminal";


// --- STATE MANAGEMENT ---
let sentHistory = []; 
let whaleHistory = []; 
let weeklyMemory = []; 
let forexMemory = [];  // <--- COPY THIS NEW LINE
let narrativeMemory = [];
let lastPrices = { bitcoin: 0, ethereum: 0, solana: 0, binancecoin: 0, gold: 0, silver: 0 };
let lastForexPrices = {};

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

// --- MODULE 1: REAL-TIME ENGINE (Updated to Capture Forex Memory) ---
const runRealTimeEngine = async () => {
  const feeds = [
    "https://cointelegraph.com/rss", 
    "https://www.cnbc.com/id/10000664/device/rss/rss.html", 
    "https://feeds.feedburner.com/coindesk"
  ];
  
  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items.slice(0, 2)) {
        const headline = item.title || "";
        const cleanTitle = headline.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (sentHistory.includes(cleanTitle)) continue;

        // 1. IRON DOME (SPAM BLOCKER)
        const isSpam = /(Shiba|Bonk|Pepe|Floki|Doge|Meme|NFT|Airdrop|Gaming|Metaverse|Hack|Exploit|Ransomware|Scam|Phishing|Cardano|ADA|Avalanche|AVAX|Tron|TRX|Mantle|Phantom|Pancake|CAKE|Polygon|MATIC|Polkadot|DOT|Litecoin|LTC)/i.test(headline);
        
        if (isSpam) {
            sentHistory.push(cleanTitle); 
            continue; 
        }

        // 2. CATEGORY DETECTION
        const isMacro = /(CPI|PPI|FOMC|Powell|Recession|Rate Hike|Rate Cut|Interest Rate|Treasury|NFP|BRICS|Federal Reserve|Central Bank|ECB|Bond Yield|Geopolitics|Trade War|Oil Price|Stimulus)/i.test(headline);
        const isCrypto = /(Bitcoin|BTC|ETH|Ethereum|Solana|SOL|BlackRock|Fidelity|ETF|Stablecoin|USDC|Coinbase|SEC|Gary Gensler|Binance|MicroStrategy)/i.test(headline);
        const isForex = /(EUR|GBP|JPY|USD|CAD|AUD|Gold|Silver|XAU|XAG|DXY|Forex|FX|BOJ|BOE|Lagarde|Ueda|Bailey|Dollar|Yen|Euro|Pound)/i.test(headline);

        // 3. ROUTING & MEMORY
        if (isMacro || isCrypto || isForex) {
          
          // Determine Color
          const bullish = /(Cut|Approval|Pump|Green|Bull|Rally|ETF|Adoption|Inflow|Gains|Record|Breakout|Whale Buy)/i.test(headline);
          const bearish = /(Hike|Panic|Crash|Dump|Drop|Inflation|Recession|SEC|Lawsuit|Hack|Outflow|Losses|War|Conflict)/i.test(headline);
          let color = 16777215;
          if (bullish) color = 3066993; else if (bearish) color = 15158332;

          // Send Alert (Real-time)
          let config = isCrypto ? { webhook: process.env.WEBHOOK_CRYPTO, name: "OASIS | Crypto Intel", ping: process.env.ROLE_ID_ALPHA, footer: CRYPTO_FOOTER }
                                : { webhook: process.env.WEBHOOK_MACRO, name: "OASIS | Macro Terminal", ping: process.env.ROLE_ID_MACRO, footer: MACRO_FOOTER };

          // Only send alert if it matches Crypto or Macro (Forex often fits in Macro for alerts)
          if (isCrypto || isMacro) {
             await axios.post(config.webhook, {
                username: config.name, avatar_url: BOT_AVATAR, content: `<@&${config.ping}>`,
                embeds: [{ title: `🚨 ${headline}`, description: (item.contentSnippet || "").substring(0, 400), url: item.link, color: color, image: extractImage(item) ? { url: extractImage(item) } : null, footer: { text: config.footer } }]
             });
             // Save to General Weekly Memory
             weeklyMemory.push({ title: headline, link: item.link });
             narrativeMemory.push(headline);
          }

          // <--- NEW: Save to FOREX MEMORY if applicable
          if (isForex || (isMacro && /(Gold|Silver|DXY|Yield)/i.test(headline))) {
              forexMemory.push({ title: headline, link: item.link });
          }
        }
        
        sentHistory.push(cleanTitle);
        if (sentHistory.length > 500) sentHistory.shift();
      }
    } catch (e) {}
  }
};

// --- MODULE 2: MARKET DESK ---
const runMarketDesk = async (isOpen) => {
  try {
    const prompt = `Output ONLY the data in this EXACT format. No intro text.
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
    Emoji Rules: 📈 for up, 📉 for down, 🛡️ for flat. Place ONLY after "Level". NO emoji after "24h Change".`;

    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Fetch market data." }] }],
      systemInstruction: { parts: [{ text: prompt }] },
      tools: [{ "google_search": {} }]
    });

    const data = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (data) {
      await axios.post(process.env.WEBHOOK_MARKET, {
        username: "OASIS | Market Desk", avatar_url: BOT_AVATAR,
        embeds: [{ title: isOpen ? "🔔 NYSE SESSION OPEN" : "🌆 NYSE SESSION CLOSE", description: data.replace(/Topic:.*\n/g, "").trim(), color: 16777215, footer: { text: "Market Settlement • Oasis Terminal" }, timestamp: new Date() }]
      });
    }
  } catch (e) {}
};

// --- MODULE 3: LIQUIDATION WATCH (Heatmaps) ---
const runLiquidationWatch = async () => {
  console.log('💥 Scanning for Liquidations...');
  try {
    const prompt = `You are a Risk Manager. Search Liquidation Heatmaps (last 24h).
    Report ONLY on **BTC, ETH, and SOL**. Ignore memecoins.
    1. **MAJOR WALLS**: Where is >$50M liquidity sitting?
    2. **WHALE ACTIVITY**: Largest single liquidation for BTC/ETH/SOL.
    3. **RISK**: "Long Squeeze" or "Short Squeeze"?
    Format: Clean bullets. Institutional tone. No intro.`;

    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, { contents: [{ parts: [{ text: "Analyze Liquidations for BTC/ETH/SOL." }] }], systemInstruction: { parts: [{ text: prompt }] }, tools: [{ "google_search": {} }] });
    const analysis = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (analysis) {
      await axios.post(process.env.WEBHOOK_LIQUIDATIONS, { username: "OASIS | Liquidity Tracker", avatar_url: BOT_AVATAR, embeds: [{ title: "🔥 LIQUIDATION HEATMAP ANALYSIS", description: analysis, color: 15158332, footer: { text: LIQ_FOOTER } }] });
    }
  } catch (e) {}
};

// --- MODULE 4: WEEKLY WRAP ---
const runWeeklyWrap = async () => {
  if (weeklyMemory.length < 5) return;
  try {
    const titles = weeklyMemory.map(i => i.title).join("\n");
    const prompt = `Senior Institutional Analyst. Generate 3-bullet summary with bold headers. Headlines:\n${titles}`;
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, { contents: [{ parts: [{ text: "Generate Weekly Wrap" }] }], systemInstruction: { parts: [{ text: prompt }] } });
    const summary = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    const sources = weeklyMemory.slice(-5).map(i => `• [${i.title}](${i.link})`).join("\n");
    if (summary) {
      await axios.post(process.env.WEBHOOK_WEEKLY, { username: "OASIS | Reports", avatar_url: BOT_AVATAR, embeds: [{ title: "🗞️ MARKET OVERVIEW", description: `**Summary:**\n${summary}\n\n**Primary Source:**\n${sources}`, color: 16777215, image: { url: WEEKLY_HEADER_IMG }, footer: { text: WEEKLY_FOOTER } }] });
    }
    weeklyMemory = [];
  } catch (e) {}
};

// --- MODULE 5: MORNING BRIEF ---
const runMorningBrief = async () => {
  try {
    const prompt = `Senior Analyst. Brief: 1. VOLATILITY DANGER ZONE. 2. INSTITUTIONAL FLOWS. 3. NARRATIVE. Use headlines: ${narrativeMemory.slice(-20).join(". ")}`;
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, { contents: [{ parts: [{ text: "Create Brief" }] }], systemInstruction: { parts: [{ text: prompt }] }, tools: [{ "google_search": {} }] });
    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) { await axios.post(process.env.WEBHOOK_MARKET, { username: "OASIS | Intelligence", avatar_url: BOT_AVATAR, embeds: [{ title: "🌅 OASIS MORNING BRIEF", description: text, color: 16777215, footer: { text: BRIEF_FOOTER } }] }); }
  } catch (e) {}
};

// --- MODULE 6: PRICE WATCHDOG ---
const runPriceWatchdog = async () => {
  try {
    const res = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,gold,silver&vs_currencies=usd");
    const p = { BTC: res.data.bitcoin.usd, ETH: res.data.ethereum.usd, SOL: res.data.solana.usd, BNB: res.data.binancecoin.usd };
    const levels = { BTC: 5000, ETH: 500, SOL: 10, BNB: 50 };
    for (const asset in levels) {
      const current = p[asset];
      const previous = lastPrices[asset.toLowerCase()] || 0;
      if (previous > 0 && Math.floor(current / levels[asset]) !== Math.floor(previous / levels[asset])) {
        const target = Math.floor(current / levels[asset]) * levels[asset];
        await axios.post(process.env.WEBHOOK_ALERTS, { username: "OASIS | Price Watchdog", avatar_url: BOT_AVATAR, embeds: [{ title: `⚡ PSYCHOLOGICAL LEVEL: ${asset}`, description: `**${asset}** crossed **$${target.toLocaleString()}**.\nPrice: **$${current.toLocaleString()}**`, color: current > previous ? 3066993 : 15158332, footer: { text: ALERT_FOOTER } }] });
      }
      lastPrices[asset.toLowerCase()] = current;
    }
  } catch (e) {}
};

// --- MODULE 7: SENTIMENT ---
const runFearGreed = async () => {
  try {
    const timestamp = new Date().getTime();
    const imageUrl = `https://alternative.me/crypto/fear-and-greed-index.png?t=${timestamp}`;
    const target = process.env.WEBHOOK_SNAPSHOTS || process.env.WEBHOOK_MARKET;
    await axios.post(target, { username: "OASIS | Sentiment", avatar_url: BOT_AVATAR, embeds: [{ title: "", color: 16777215, image: { url: imageUrl }, footer: { text: SENTIMENT_FOOTER } }] });
  } catch (e) {}
};

// --- MODULE 8: SESSION HANDOVER ---
const runLondonHandover = async () => {
  try {
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, { contents: [{ parts: [{ text: "Recap London" }] }], systemInstruction: { parts: [{ text: "3 bullets. Institutional tone." }] }, tools: [{ "google_search": {} }] });
    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) { await axios.post(process.env.WEBHOOK_MARKET, { username: "OASIS | Session Desk", avatar_url: BOT_AVATAR, embeds: [{ title: "🇬🇧 LONDON SESSION HANDOVER", description: text, color: 16777215, footer: { text: LONDON_FOOTER } }] }); }
  } catch (e) {}
};

// --- MODULE 9: KNOWLEDGE DROP (INFINITE VARIETY) ---
const runKnowledgeDrop = async () => {
  console.log('📖 Generating Knowledge Drop...');
  try {
    // UPDATED: Broad Category Selection for Infinite Variety
    const prompt = `You are a Senior Trading Mentor. 
    Select ONE advanced trading concept from these categories:
    [Smart Money Concepts (SMC), Wyckoff Theory, Order Flow, Market Structure, Risk Management, Derivatives, On-Chain Analysis].
    
    Do NOT select basic terms (No "Spread", "Bid/Ask", "Bull Market").
    
    Explain it to a trader.
    Format:
    **[Term Name]**
    • **Definition:** [Simple 1 sentence definition]
    • **How to Use:** [Practical tip for finding it on a chart]
    • **Fun Fact:** [A brief interesting fact or detail]
    
    STRICT RULES:
    - Do NOT ask questions.
    - Output ONLY the formatted text.`;

    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: "Teach me a trading term." }] }],
      systemInstruction: { parts: [{ text: prompt }] }
    });
    
    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      await axios.post(process.env.WEBHOOK_ACADEMY, { 
          username: "OASIS | Academy", 
          avatar_url: BOT_AVATAR, 
          embeds: [{ title: "📖 KNOWLEDGE DROP", description: text, color: 16777215, footer: { text: "Education • Oasis Terminal" } }] 
      });
    }
  } catch (e) {}
};

// --- MODULE 10: WHALE MOVEMENT (FIXED: Color & Spam) ---
const runWhaleMovement = async () => {
  console.log('🐋 Scanning for Whale Transfers...');
  try {
    const prompt = `You are a Whale Tracker. Search for large crypto transfers (Last 2 hours) from Whale Alert.
    Strict Criteria: BTC > 1,000, ETH > 10,000, SOL > 100,000.
    
    Format:
    • **Asset**: [Amount] [Ticker] moved from [Wallet/Exchange] to [Wallet/Exchange].
    • **Implication**: [One phrase: "Potential Dump", "Accumulation", "Exchange Inflow", or "Exchange Outflow"].
    
    STRICT RULES:
    - If NO transfers match the size, output EXACTLY: NULL
    - Do NOT write "No major moves found".
    - Do NOT output intro/outro conversational text.`;

    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, { contents: [{ parts: [{ text: "Scan for Whale Transfers." }] }], systemInstruction: { parts: [{ text: prompt }] }, tools: [{ "google_search": {} }] });
    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // 1. Anti-Spam (Stops "No major moves" chat)
    if (text.includes("NULL") || !text.includes("**Asset**")) return;

    // 2. Numeric Deduplication
    const numbers = text.match(/\d+(?:,\d+)*(?:\.\d+)?/g);
    const assetId = numbers ? numbers[0].replace(/,/g, '') : "unknown"; 
    
    if (whaleHistory.includes(assetId)) return;

    // 3. Dynamic Color Logic
    let color = 16777215; // White Default
    const lower = text.toLowerCase();
    if (lower.includes("dump") || lower.includes("inflow") || lower.includes("exchange") || lower.includes("sell")) {
        color = 15158332; // RED (Danger)
    } else if (lower.includes("accumulation") || lower.includes("outflow") || lower.includes("staking") || lower.includes("buy")) {
        color = 3066993; // GREEN (Safe)
    }

    await axios.post(process.env.WEBHOOK_WHALE, { 
        username: "OASIS | Whale Tracker", 
        avatar_url: BOT_AVATAR, 
        embeds: [{ title: "🐋 WHALE MOVEMENT ALERT", description: text, color: color, footer: { text: WHALE_FOOTER } }] 
    });

    whaleHistory.push(assetId);
    if (whaleHistory.length > 20) whaleHistory.shift();

  } catch (e) {}
};

// --- MODULE 11: FOREX WATCHDOG ---
const runForexWatchdog = async () => {
    try {
        const prompt = `Fetch current prices for: Gold (XAU/USD), Silver (XAG/USD), EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD. 
        Output STRICT JSON format: 
        { "XAU/USD": 2350.50, "XAG/USD": 29.50, "EUR/USD": 1.0850, "GBP/USD": 1.2750, "USD/JPY": 155.00, "AUD/USD": 0.6650, "USD/CAD": 1.3650 }`;
        
        const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            contents: [{ parts: [{ text: "Get Forex Prices" }] }],
            systemInstruction: { parts: [{ text: prompt }] },
            tools: [{ "google_search": {} }],
            generationConfig: { responseMimeType: "application/json" }
        });

        const data = JSON.parse(res.data.candidates[0].content.parts[0].text);
        const steps = { "XAU/USD": 25, "XAG/USD": 0.50, "USD/JPY": 0.50, "default": 0.0050 };

        for (const [pair, price] of Object.entries(data)) {
            const step = steps[pair] || steps["default"];
            const prev = lastForexPrices[pair] || 0;

            if (prev > 0) {
                const prevLevel = Math.floor(prev / step);
                const currLevel = Math.floor(price / step);

                if (prevLevel !== currLevel) {
                    const crossed = (currLevel * step).toFixed(pair.includes("JPY") || pair.includes("XAU") ? 2 : 4);
                    const direction = price > prev ? "📈 BREAKOUT" : "📉 BREAKDOWN";
                    const color = price > prev ? 3066993 : 15158332;

                    await axios.post(process.env.WEBHOOK_FXALERT, {
                        username: "OASIS | FX Watchdog",
                        avatar_url: BOT_AVATAR,
                        embeds: [{
                            title: `${direction}: ${pair}`,
                            description: `**${pair}** has crossed the **${crossed}** psychological level.\nCurrent Price: **${price}**`,
                            color: color,
                            footer: { text: FOREX_FOOTER }
                        }]
                    });
                }
            }
            lastForexPrices[pair] = price;
        }
    } catch (e) {}
};

// --- MODULE 12: FOREX WEEKLY DIGEST (Final: Memory -> Summary + Sources) ---
const runForexWeekly = async () => {
    console.log('💱 Generating FX Weekly...');
    
    // 1. Check Data Store (Memory)
    if (forexMemory.length === 0) {
        console.log("No FX memory found, skipping or using fallback...");
        return;
    }

    // 2. Generate Report from Memory
    try {
        // Prepare titles for the AI to analyze
        const titles = forexMemory.map(i => i.title).join("\n");

        // The Prompt: Feeds titles, asks for Analysis ONLY
        const prompt = `Senior Forex Analyst. Analyze these headlines collected over the week:\n${titles}\n\nTask: Write a concise **Weekly Forex Outlook**.\n- Do NOT list the headlines again.\n- Synthesize the data into 3 high-impact bullets with bold headers.\n- Focus on Central Banks, Yields, and DXY context.`;

        const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            contents: [{ parts: [{ text: "Generate Forex Weekly" }] }],
            systemInstruction: { parts: [{ text: prompt }] }
        });

        const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        // Generate the Source List (Top 5 links)
        const sources = forexMemory.slice(-5).map(i => `• [${i.title}](${i.link})`).join("\n");

        if (text) {
            await axios.post(process.env.WEBHOOK_FOREX, {
                username: "OASIS | FX Intelligence",
                avatar_url: BOT_AVATAR,
                embeds: [{
                    title: "💱 WEEKLY FOREX OUTLOOK",
                    description: `**Summary:**\n${text}\n\n**Primary Sources:**\n${sources}`,
                    color: 16777215,
                    image: { url: WEEKLY_HEADER_IMG }, 
                    footer: { text: "Institutional FX Strategy • Oasis Terminal" }
                }]
            });
        }
        forexMemory = []; // Clear memory after successful report
    } catch (e) { console.error("FX Weekly Error:", e.message); }
};

// --- SCHEDULES (UTC) ---
cron.schedule('*/5 * * * *', runRealTimeEngine);
cron.schedule('0 */4 * * *', runLiquidationWatch); // Heatmaps every 4h
cron.schedule('0 */2 * * *', runWhaleMovement);    // Transfers every 2h
cron.schedule('*/15 * * * *', runPriceWatchdog);
cron.schedule('0 0,12 * * *', runKnowledgeDrop);
cron.schedule('0 12 * * 1-5', runLondonHandover);
cron.schedule('30 13 * * 1-5', runMorningBrief);
cron.schedule('30 14 * * 1-5', () => runMarketDesk(true));
cron.schedule('0 21 * * 1-5', () => runMarketDesk(false));
cron.schedule('0 6 * * *', runFearGreed);
cron.schedule('0 19 * * 0', async () => { await runWeeklyWrap(); weeklyMemory = []; });
cron.schedule('*/30 * * * *', runForexWatchdog);
cron.schedule('0 20 * * 0', runForexWeekly);
app.listen(port, () => console.log(`Oasis Terminal v4.7 Fully Operational`));

// --- TEST ROUTES ---
app.get('/test-whale', async (req, res) => { await runWhaleMovement(); res.send("Whale Move Triggered"); });
app.get('/test-sentiment', async (req, res) => { await runFearGreed(); res.send("Sentiment Triggered"); });
app.get('/test-liq', async (req, res) => { await runLiquidationWatch(); res.send("Liquidation Triggered"); });
app.get('/test-wrap', async (req, res) => { weeklyMemory=[{title:"Test Headline",link:"#"}]; await runWeeklyWrap(); res.send("Wrap Triggered"); });
app.get('/test-desk', async (req, res) => { await runMarketDesk(true); res.send("Desk Triggered"); });
app.get('/test-brief', async (req, res) => { await runMorningBrief(); res.send("Brief Triggered"); });
app.get('/test-Forex', async (req, res) => { await runForexWatchdog(); res.send("FX Watchdog Triggered (Check Discord for Breakout/Breakdown alerts)"); });
app.get('/test-forex-weekly', async (req, res) => { 
    // Seed fake memory to test formatting instantly
    forexMemory = [
        { title: "Gold Breaks $2,400 Amid Geopolitical Tensions", link: "https://cnbc.com" },
        { title: "ECB Signals Rate Cut for June as Inflation Cools", link: "https://bloomberg.com" },
        { title: "USD/JPY Hits 155.00 on Strong US Jobs Data", link: "https://reuters.com" }
    ];
    await runForexWeekly(); 
    res.send("FX Weekly Report Triggered (Check Discord)"); 
});
