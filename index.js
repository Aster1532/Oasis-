// --- [CRITICAL] Load environment variables FIRST ---
require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// --- KEEP-ALIVE SERVER ---
app.get('/', (req, res) => res.send('Oasis Ecosystem: Systems Operational.'));

// --- CORE DEPENDENCIES ---
const axios = require('axios');
const Parser = require('rss-parser');
const cron = require('node-cron');
const fs = require('fs'); 

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

// --- PERSISTENT STATE MANAGEMENT ---
// Note: On Render Free Tier, this file wipes on restart. 
// The code handles this by recreating default state automatically.
const MEMORY_FILE = './memory.json';

// Default state structure
let state = {
  sentHistory: [],
  whaleHistory: [],
  weeklyMemory: [],
  forexMemory: [],
  narrativeMemory: [],
  lastPrices: { bitcoin: 0, ethereum: 0, solana: 0, binancecoin: 0, gold: 0, silver: 0 },
  lastForexPrices: {}
};

// Load Memory from File
const loadMemory = () => {
  if (fs.existsSync(MEMORY_FILE)) {
    try {
      const raw = fs.readFileSync(MEMORY_FILE);
      const loaded = JSON.parse(raw);
      state = { ...state, ...loaded }; 
      console.log("🧠 Memory System: Loaded successfully.");
    } catch (e) {
      console.error("⚠️ Memory Load Failed (Starting Fresh):", e.message);
    }
  } else {
    console.log("🆕 No memory file found. Starting with fresh state.");
  }
};

// Save Memory to File
const saveMemory = () => {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error("⚠️ Memory Save Failed:", e.message);
  }
};

// Initialize Memory on Boot
loadMemory();

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

// --- HELPER: GEMINI API CALL (Centralized & Robust) ---
const askGemini = async (prompt, systemInstruction, isJson = false, useSearch = false) => {
  try {
    // Use Preview model for Tools/Search support, or standard for text
    const model = "gemini-2.5-flash-preview-09-2025"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] }
    };

    if (isJson) {
      payload.generationConfig = { responseMimeType: "application/json" };
    }
    
    if (useSearch) {
        payload.tools = [{ "google_search": {} }];
    }

    const res = await axios.post(url, payload);
    return res.data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (e) {
    console.error(`⛔ Gemini API Error (${prompt.substring(0, 15)}...):`, e.response ? e.response.data : e.message);
    return null;
  }
};


// --- MODULE 1: REAL-TIME ENGINE (Triple Filter + Memory) ---
const runRealTimeEngine = async () => {
  const feeds = [
    "https://cointelegraph.com/rss", 
    "https://www.cnbc.com/id/10000664/device/rss/rss.html", 
    "https://feeds.feedburner.com/coindesk"
  ];
  
  let memoryChanged = false;

  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items.slice(0, 2)) {
        const headline = item.title || "";
        const cleanTitle = headline.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        if (state.sentHistory.includes(cleanTitle)) continue;

        // 1. IRON DOME (SPAM BLOCKER)
        const isSpam = /(Shiba|Bonk|Pepe|Floki|Doge|Meme|NFT|Airdrop|Gaming|Metaverse|Hack|Exploit|Ransomware|Scam|Phishing|Cardano|ADA|Avalanche|AVAX|Tron|TRX|Mantle|Phantom|Pancake|CAKE|Polygon|MATIC|Polkadot|DOT|Litecoin|LTC)/i.test(headline);
        
        if (isSpam) {
            state.sentHistory.push(cleanTitle); 
            memoryChanged = true;
            continue; 
        }

        // 2. CATEGORY DETECTION
        const isMacro = /(CPI|PPI|FOMC|Powell|Recession|Rate Hike|Rate Cut|Interest Rate|Treasury|NFP|BRICS|Federal Reserve|Central Bank|ECB|Bond Yield|Geopolitics|Trade War|Oil Price|Stimulus)/i.test(headline);
        const isCrypto = /(Bitcoin|BTC|ETH|Ethereum|Solana|SOL|BlackRock|Fidelity|ETF|Stablecoin|USDC|Coinbase|SEC|Gary Gensler|Binance|MicroStrategy)/i.test(headline);
        const isForex = /(EUR|GBP|JPY|USD|CAD|AUD|Gold|Silver|XAU|XAG|DXY|Forex|FX|BOJ|BOE|Lagarde|Ueda|Bailey|Dollar|Yen|Euro|Pound)/i.test(headline);

        // 3. ROUTING & MEMORY
        if (isMacro || isCrypto || isForex) {
          
          const bullish = /(Cut|Approval|Pump|Green|Bull|Rally|ETF|Adoption|Inflow|Gains|Record|Breakout|Whale Buy)/i.test(headline);
          const bearish = /(Hike|Panic|Crash|Dump|Drop|Inflation|Recession|SEC|Lawsuit|Hack|Outflow|Losses|War|Conflict)/i.test(headline);
          let color = 16777215;
          if (bullish) color = 3066993; else if (bearish) color = 15158332;

          let config = isCrypto ? { webhook: process.env.WEBHOOK_CRYPTO, name: "OASIS | Crypto Intel", ping: process.env.ROLE_ID_ALPHA, footer: CRYPTO_FOOTER }
                                : { webhook: process.env.WEBHOOK_MACRO, name: "OASIS | Macro Terminal", ping: process.env.ROLE_ID_MACRO, footer: MACRO_FOOTER };

          if (isCrypto || isMacro) {
             await axios.post(config.webhook, {
                username: config.name, avatar_url: BOT_AVATAR, content: `<@&${config.ping}>`,
                embeds: [{ title: `🚨 ${headline}`, description: (item.contentSnippet || "").substring(0, 400), url: item.link, color: color, image: extractImage(item) ? { url: extractImage(item) } : null, footer: { text: config.footer } }]
             });
             
             state.weeklyMemory.push({ title: headline, link: item.link });
             state.narrativeMemory.push(headline);
             memoryChanged = true;
          }

          if (isForex || (isMacro && /(Gold|Silver|DXY|Yield)/i.test(headline))) {
              state.forexMemory.push({ title: headline, link: item.link });
              memoryChanged = true;
          }
        }
        
        state.sentHistory.push(cleanTitle);
        if (state.sentHistory.length > 500) state.sentHistory.shift();
        memoryChanged = true;
      }
    } catch (e) {
        console.error(`Feed Error [${url}]:`, e.message);
    }
  }

  if (memoryChanged) saveMemory();
};

// --- MODULE 2: MARKET DESK ---
const runMarketDesk = async (isOpen) => {
  try {
    const prompt = `Topic: ${isOpen ? "🔔 NYSE SESSION OPEN" : "🌆 NYSE SESSION CLOSE"}
    Fetch data for DXY, US 10Y Yield, and S&P 500.`;
    
    const system = `Output ONLY the data in this EXACT format. No intro text.
    • **DXY (Dollar Index)**
        • Level: [Value] [Emoji]
        • 24h Change: [Value]
    • **US 10Y Treasury Yield**
        • Level: [Value] [Emoji]
        • 24h Change: [Value]
    • **S&P 500 Index**
        • Level: [Value] [Emoji]
        • 24h Change: [Value]
    Emoji Rules: 📈 for up, 📉 for down, 🛡️ for flat. Place ONLY after "Level". NO emoji after "24h Change".
    Do NOT explain holidays.`;

    // Use Search to get live data
    const data = await askGemini(prompt, system, false, true);
    
    if (data) {
      await axios.post(process.env.WEBHOOK_MARKET, {
        username: "OASIS | Market Desk", avatar_url: BOT_AVATAR,
        embeds: [{ title: isOpen ? "🔔 NYSE SESSION OPEN" : "🌆 NYSE SESSION CLOSE", description: data.replace(/Topic:.*\n/g, "").trim(), color: 16777215, footer: { text: "Market Settlement • Oasis Terminal" }, timestamp: new Date() }]
      });
    }
  } catch (e) { console.error("Market Desk Error:", e.message); }
};

// --- MODULE 3: LIQUIDATION WATCH ---
const runLiquidationWatch = async () => {
  console.log('💥 Scanning for Liquidations...');
  try {
    const prompt = "Analyze Liquidations for BTC/ETH/SOL.";
    const system = `You are a Risk Manager. Search Liquidation Heatmaps (last 24h).
    Report ONLY on **BTC, ETH, and SOL**. Ignore memecoins.
    1. **MAJOR WALLS**: Where is >$50M liquidity sitting?
    2. **WHALE ACTIVITY**: Largest single liquidation.
    3. **RISK**: "Long Squeeze" or "Short Squeeze"?
    Format: Clean bullets. Institutional tone. No intro.`;

    const analysis = await askGemini(prompt, system, false, true); // Search enabled
    if (analysis) {
      await axios.post(process.env.WEBHOOK_LIQUIDATIONS, { username: "OASIS | Liquidity Tracker", avatar_url: BOT_AVATAR, embeds: [{ title: "🔥 LIQUIDATION HEATMAP ANALYSIS", description: analysis, color: 15158332, footer: { text: LIQ_FOOTER } }] });
    }
  } catch (e) { console.error("Liquidation Error:", e.message); }
};

// --- MODULE 4: WEEKLY WRAP (CRYPTO) ---
const runWeeklyWrap = async () => {
  if (state.weeklyMemory.length < 5) return;
  try {
    const titles = state.weeklyMemory.map(i => i.title).join("\n");
    const prompt = `Generate Weekly Wrap from these headlines:\n${titles}`;
    const system = "Senior Institutional Analyst. Generate 3-bullet summary with bold headers.";
    
    const summary = await askGemini(prompt, system);
    const sources = state.weeklyMemory.slice(-5).map(i => `• [${i.title}](${i.link})`).join("\n");
    
    if (summary) {
      await axios.post(process.env.WEBHOOK_WEEKLY, { username: "OASIS | Reports", avatar_url: BOT_AVATAR, embeds: [{ title: "🗞️ MARKET OVERVIEW", description: `**Summary:**\n${summary}\n\n**Primary Source:**\n${sources}`, color: 16777215, image: { url: WEEKLY_HEADER_IMG }, footer: { text: WEEKLY_FOOTER } }] });
    }
    state.weeklyMemory = [];
    saveMemory();
  } catch (e) { console.error("Weekly Wrap Error:", e.message); }
};

// --- MODULE 5: MORNING BRIEF ---
const runMorningBrief = async () => {
  try {
    const prompt = `Senior Institutional Analyst. Search for the most critical global financial and crypto news (last 24h). Generate a **Morning Brief**: 1. THE DANGER ZONE. 2. INSTITUTIONAL FLOWS. 3. MARKET NARRATIVE. Style: Professional Wall Street tone. High signal only.`;
    const text = await askGemini("Create Morning Brief", prompt, false, true); // Search enabled
    
    if (text) { 
        await axios.post(process.env.WEBHOOK_MARKET, { username: "OASIS | Intelligence", avatar_url: BOT_AVATAR, embeds: [{ title: "🌅 OASIS MORNING BRIEF", description: text, color: 16777215, footer: { text: BRIEF_FOOTER } }] }); 
    }
  } catch (e) { console.error("Morning Brief Error:", e.message); }
};

// --- MODULE 6: PRICE WATCHDOG (CRYPTO) ---
const runPriceWatchdog = async () => {
  try {
    const res = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,gold,silver&vs_currencies=usd");
    const p = { BTC: res.data.bitcoin.usd, ETH: res.data.ethereum.usd, SOL: res.data.solana.usd, BNB: res.data.binancecoin.usd };
    const levels = { BTC: 5000, ETH: 500, SOL: 10, BNB: 50 };
    let changed = false;

    for (const asset in levels) {
      const current = p[asset];
      const previous = state.lastPrices[asset.toLowerCase()] || 0;
      
      if (previous === 0) {
          state.lastPrices[asset.toLowerCase()] = current;
          changed = true;
          continue;
      }

      if (Math.floor(current / levels[asset]) !== Math.floor(previous / levels[asset])) {
        const target = Math.floor(current / levels[asset]) * levels[asset];
        const color = current > previous ? 3066993 : 15158332;
        await axios.post(process.env.WEBHOOK_ALERTS, { username: "OASIS | Price Watchdog", avatar_url: BOT_AVATAR, embeds: [{ title: `⚡ PSYCHOLOGICAL LEVEL: ${asset}`, description: `**${asset}** crossed **$${target.toLocaleString()}**.\nPrice: **$${current.toLocaleString()}**`, color: color, footer: { text: ALERT_FOOTER } }] });
      }
      state.lastPrices[asset.toLowerCase()] = current;
      changed = true;
    }
    if (changed) saveMemory();

  } catch (e) { console.error("Price Watchdog Error:", e.message); }
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
    const text = await askGemini("Recap London", "3 bullets. Institutional tone.", false, true); // Search enabled
    if (text) { await axios.post(process.env.WEBHOOK_MARKET, { username: "OASIS | Session Desk", avatar_url: BOT_AVATAR, embeds: [{ title: "🇬🇧 LONDON SESSION HANDOVER", description: text, color: 16777215, footer: { text: LONDON_FOOTER } }] }); }
  } catch (e) {}
};

// --- MODULE 9: KNOWLEDGE DROP ---
const runKnowledgeDrop = async () => {
  console.log('📖 Generating Knowledge Drop...');
  try {
    const prompt = "Teach me a trading term.";
    const system = `You are a Senior Trading Mentor. 
    Select ONE advanced trading concept from: [Smart Money Concepts, Wyckoff, Order Flow, Market Structure].
    Format:
    **[Term Name]**
    • **Definition:** ...
    • **How to Use:** ...
    • **Fun Fact:** ...
    NO questions. NO intro.`;

    const text = await askGemini(prompt, system);
    if (text) {
      await axios.post(process.env.WEBHOOK_ACADEMY, { username: "OASIS | Academy", avatar_url: BOT_AVATAR, embeds: [{ title: "📖 KNOWLEDGE DROP", description: text, color: 16777215, footer: { text: "Education • Oasis Terminal" } }] });
    }
  } catch (e) { console.error("Knowledge Drop Error:", e.message); }
};

// --- MODULE 10: WHALE MOVEMENT ---
const runWhaleMovement = async () => {
  console.log('🐋 Scanning for Whale Transfers...');
  try {
    const prompt = "Scan for Whale Transfers (BTC > 1000, ETH > 10000).";
    const system = `You are a Whale Tracker. Search Whale Alert.
    Strict Criteria: BTC > 1,000, ETH > 10,000, SOL > 100,000.
    Format:
    • **Asset**: [Amount] [Ticker] moved from [Wallet] to [Wallet].
    • **Implication**: [One phrase].
    If NONE match, output: NULL`;

    const text = await askGemini(prompt, system, false, true); // Search enabled
    
    if (!text || text.includes("NULL") || !text.includes("**Asset**")) return;

    const numbers = text.match(/\d+(?:,\d+)*(?:\.\d+)?/g);
    const assetId = numbers ? numbers[0].replace(/,/g, '') : "unknown"; 
    
    if (state.whaleHistory.includes(assetId)) return;

    let color = 16777215; 
    if (/dump|inflow|exchange|sell/i.test(text)) color = 15158332; 
    else if (/accumulation|outflow|buy/i.test(text)) color = 3066993;

    await axios.post(process.env.WEBHOOK_WHALE, { username: "OASIS | Whale Tracker", avatar_url: BOT_AVATAR, embeds: [{ title: "🐋 WHALE MOVEMENT ALERT", description: text, color: color, footer: { text: WHALE_FOOTER } }] });

    state.whaleHistory.push(assetId);
    if (state.whaleHistory.length > 20) state.whaleHistory.shift();
    saveMemory();

  } catch (e) { console.error("Whale Error:", e.message); }
};

// --- MODULE 11: FOREX WATCHDOG (Fixed JSON Parsing) ---
const runForexWatchdog = async () => {
    console.log('💱 Running Forex Watchdog...');
    if (!process.env.WEBHOOK_FOREX) {
        console.error("❌ ERROR: WEBHOOK_FOREX is missing in .env");
        return;
    }

    try {
        const prompt = "Get current prices for: Gold (XAU/USD), Silver (XAG/USD), EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD.";
        const system = `Output STRICT JSON format only. Do not use Markdown. 
        Example: { "XAU/USD": 2350.50, "XAG/USD": 29.50, "EUR/USD": 1.0850, "GBP/USD": 1.2750, "USD/JPY": 155.00, "AUD/USD": 0.6650, "USD/CAD": 1.3650 }`;
        
        // 1. Ask Gemini (Search Enabled to get live prices)
        let text = await askGemini(prompt, system, true, true); 
        if (!text) return;

        // 2. CLEAN THE RESPONSE (The Fix)
        // Gemini loves adding ```json ... ```. We must remove it.
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // 3. Parse
        const data = JSON.parse(text);
        const steps = { "XAU/USD": 25, "XAG/USD": 0.50, "USD/JPY": 0.50, "default": 0.0050 };
        let changed = false;

        for (const [pair, price] of Object.entries(data)) {
            const step = steps[pair] || steps["default"];
            const prev = state.lastForexPrices[pair] || 0;

            // Initialize previous price if empty
            if (prev === 0) {
                state.lastForexPrices[pair] = price;
                changed = true;
                continue;
            }

            const prevLevel = Math.floor(prev / step);
            const currLevel = Math.floor(price / step);

            if (prevLevel !== currLevel) {
                const crossed = (currLevel * step).toFixed(pair.includes("JPY") || pair.includes("XAU") ? 2 : 4);
                const direction = price > prev ? "📈 BREAKOUT" : "📉 BREAKDOWN";
                const color = price > prev ? 3066993 : 15158332;

                console.log(`🚀 Sending Alert: ${pair} at ${price}`);

                await axios.post(process.env.WEBHOOK_FOREX, {
                    username: "OASIS | FX Watchdog", avatar_url: BOT_AVATAR,
                    embeds: [{ title: `${direction}: ${pair}`, description: `**${pair}** has crossed the **${crossed}** psychological level.\nCurrent Price: **${price}**`, color: color, footer: { text: FOREX_FOOTER } }]
                });
            }
            state.lastForexPrices[pair] = price;
            changed = true;
        }
        if (changed) saveMemory();

    } catch (e) { 
        console.error("Forex Watchdog Critical Error:", e.message); 
        // If JSON parse fails, log the raw text to see what Gemini actually sent
        if (e instanceof SyntaxError) console.error("Raw Invalid JSON:", e.message);
    }
};

// --- MODULE 12: FOREX WEEKLY DIGEST (Fixed Memory Handling) ---
const runForexWeekly = async () => {
    console.log('💱 Generating FX Weekly...');
    
    // 1. Safety Check: Is there memory?
    if (!state.forexMemory || state.forexMemory.length === 0) {
        console.log("⚠️ No FX news in memory. Creating a 'Live Search' report instead...");
        
        // FALLBACK: If no memory, Search live instead of failing
        const prompt = "Search for the biggest Forex news this week (EUR, USD, JPY, Gold). Write a 3-bullet Weekly Outlook.";
        const text = await askGemini("Weekly FX Outlook", prompt, false, true); // Search enabled
        
        if (text) {
             await axios.post(process.env.WEBHOOK_FOREX, {
                username: "OASIS | FX Intelligence",
                avatar_url: BOT_AVATAR,
                embeds: [{ title: "💱 WEEKLY FOREX OUTLOOK (Live Scan)", description: text, color: 16777215, image: { url: WEEKLY_HEADER_IMG }, footer: { text: "Institutional FX Strategy • Oasis Terminal" } }]
            });
        }
        return;
    }

    // 2. Generate Report from Actual Memory
    try {
        const titles = state.forexMemory.map(i => i.title).join("\n");
        const prompt = `Analyze these Forex headlines collected over the week:\n${titles}\n\nTask: Write a concise **Weekly Forex Outlook**.\n- Synthesize the data into 3 high-impact bullets with bold headers.\n- Focus on Central Banks, Yields, and DXY context.`;

        const text = await askGemini(prompt, "Senior Forex Analyst.", false, false); // No search needed, we have data
        
        const sources = state.forexMemory.slice(-5).map(i => `• [${i.title}](${i.link})`).join("\n");

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
        
        state.forexMemory = []; 
        saveMemory();
        console.log("✅ FX Weekly Sent Successfully.");

    } catch (e) { console.error("FX Weekly Error:", e.message); }
};

// --- SCHEDULES (UTC) ---
cron.schedule('*/5 * * * *', runRealTimeEngine);
cron.schedule('0 */4 * * *', runLiquidationWatch); // Heatmaps every 4h
cron.schedule('0 */2 * * *', runWhaleMovement);    // Transfers every 2h
cron.schedule('*/15 * * * *', runPriceWatchdog);
cron.schedule('0 0,12 * * *', runKnowledgeDrop);
cron.schedule('30 14 * * 1-5', () => runMarketDesk(true));
cron.schedule('0 21 * * 1-5', () => runMarketDesk(false));
cron.schedule('0 19 * * 0', runWeeklyWrap);
cron.schedule('*/30 * * * *', runForexWatchdog);
cron.schedule('0 20 * * 0', runForexWeekly); 
cron.schedule('30 13 * * 1-5', runMorningBrief);
cron.schedule('0 12 * * 1-5', runLondonHandover);
cron.schedule('0 6 * * *', runFearGreed);

app.listen(port, () => console.log(`Oasis Terminal v5.6 Fully Operational`));

// --- TEST ROUTES ---

// TEST WATCHDOG: We force the price change logic by manually setting an old price
app.get('/test-forex', async (req, res) => { 
    console.log("Manual trigger: Forex Watchdog");
    // Hack: Set previous price of Gold to 2000 so the current price triggers an alert
    state.lastForexPrices["XAU/USD"] = 2000; 
    await runForexWatchdog(); 
    res.send("FX Watchdog Triggered. check logs for 'Sending Alert' message."); 
});

// TEST WEEKLY: We inject fake news so it doesn't use the fallback
app.get('/test-forex-weekly', async (req, res) => { 
    console.log("Manual trigger: Forex Weekly");
    state.forexMemory = [
        { title: "Gold Breaks $2,400 Amid Geopolitical Tensions", link: "https://cnbc.com" },
        { title: "ECB Signals Rate Cut for June as Inflation Cools", link: "https://bloomberg.com" },
        { title: "USD/JPY Hits 155.00 on Strong US Jobs Data", link: "https://reuters.com" }
    ];
    await runForexWeekly(); 
    res.send("FX Weekly Report Sent to Discord."); 
});
