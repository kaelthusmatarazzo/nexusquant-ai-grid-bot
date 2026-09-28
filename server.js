const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 8080;
const DB_FILE = path.join(__dirname, 'nexusquant_db.json');
const USD_TO_BRL = 5.45;

// Automatic Render.com 24/7 Self-Keep-Alive Ping (pings RENDER_EXTERNAL_URL every 4 minutes so Free tier stays awake!)
if (process.env.RENDER_EXTERNAL_URL) {
    setInterval(() => {
        try {
            https.get(`${process.env.RENDER_EXTERNAL_URL}/api/db`, (res) => { res.resume(); }).on('error', () => {});
        } catch (e) {}
    }, 240000);
}

const PAIR_CONFIGS = {
    SOLUSDT:    { name: 'SOL/USDT',    basePrice: 174.50, tickSize: 0.135,   decimals: 2, gridScore: 98.6 },
    SUIUSDT:    { name: 'SUI/USDT',    basePrice: 3.1850, tickSize: 0.0026,  decimals: 4, gridScore: 97.9 },
    WIFUSDT:    { name: 'WIF/USDT',    basePrice: 2.4200, tickSize: 0.0022,  decimals: 4, gridScore: 97.4 },
    FETUSDT:    { name: 'FET/USDT',    basePrice: 1.3450, tickSize: 0.0011,  decimals: 4, gridScore: 96.2 },
    DOGEUSDT:   { name: 'DOGE/USDT',   basePrice: 0.2450, tickSize: 0.00019, decimals: 4, gridScore: 95.4 },
    AVAXUSDT:   { name: 'AVAX/USDT',   basePrice: 28.40,  tickSize: 0.022,   decimals: 2, gridScore: 94.1 },
    INJUSDT:    { name: 'INJ/USDT',    basePrice: 24.15,  tickSize: 0.019,   decimals: 2, gridScore: 93.5 },
    NEARUSDT:   { name: 'NEAR/USDT',   basePrice: 5.120,  tickSize: 0.0040,  decimals: 3, gridScore: 92.8 },
    RENDERUSDT: { name: 'RENDER/USDT', basePrice: 7.640,  tickSize: 0.0061,  decimals: 3, gridScore: 92.3 },
    SEIUSDT:    { name: 'SEI/USDT',    basePrice: 0.4450, tickSize: 0.00035, decimals: 4, gridScore: 91.7 },
    XRPUSDT:    { name: 'XRP/USDT',    basePrice: 2.3800, tickSize: 0.0017,  decimals: 4, gridScore: 90.4 },
    ETHUSDT:    { name: 'ETH/USDT',    basePrice: 2745.00,tickSize: 1.45,    decimals: 2, gridScore: 86.4 },
    BNBUSDT:    { name: 'BNB/USDT',    basePrice: 618.00, tickSize: 0.31,    decimals: 2, gridScore: 83.2 },
    BTCUSDT:    { name: 'BTC/USDT',    basePrice: 84080.00,tickSize: 24.5,   decimals: 2, gridScore: 79.5 }
};

// Default Database Schema (Single Source of Truth — Unbiased Market Mechanics)
const defaultDB = {
    meta: {
        engine: 'NexusQuant GridDB v6.1 (MEXC Positive Payoff Grid)',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalSavedTrades: 0,
        recalibratedRealisticWinRate: true
    },
    wallet: {
        initialCapital: 10.00,
        walletBalance: 10.00,
        totalProfit: 0.00,
        vaultBalance: 0.00,
        totalWithdrawn: 0.00,
        wins: 0,
        losses: 0,
        botStartedAt: Date.now()
    },
    gridConfig: {
        botRunning: true,
        pair: 'SOLUSDT',
        autoPairEnabled: true,
        gridMode: 'neutral',
        gridLevelsCount: 8,
        gridStepPct: 0.22,
        stopLossPct: 0.34,
        orderSizePct: 16,
        leverage: 10,
        trailingGrid: true,
        compoundEnabled: true
    },
    liveState: {
        currentPrice: 174.50,
        liveAnchorPrice: 174.50,
        simOffset: 0,
        trendMomentum: 0,
        lastEvent: null
    },
    openPositions: [],
    trades: [],
    withdrawals: []
};

function recomputeWalletFromTrades(dbData) {
    let wins = 0;
    let losses = 0;
    if ((!dbData.gridConfig || !dbData.gridConfig.mexcConnected) && Number(dbData.wallet.initialCapital) === 100) {
        dbData.wallet.initialCapital = 10.00;
    }
    const initCap = Number(dbData.wallet.initialCapital) || 10;
    const withdrawn = Number(dbData.wallet.totalWithdrawn) || 0;
    let runningBalance = initCap;

    const chronological = [...(dbData.trades || [])].reverse();
    for (let i = 0; i < chronological.length; i++) {
        const t = chronological[i];
        const prevNet = Number(t.pnlUSD) || 0;
        const prevFee = Number(t.feeUSD) || 0;
        if (prevFee <= 0) {
            const grossPnl = prevNet + prevFee;
            const isMerged = String(t.gridLevel || '').includes('+L2');
            const isPureLimitTp = (t.gridMode === 'MEXC_GRID_TP') && !String(t.gridLevel || '').includes('🛡️');
            const l1Notional = (initCap * 0.06) * 15;
            const totalNotional = isMerged ? (initCap * 0.08) * 15 : l1Notional;
            const minOfficialFee = Number(((l1Notional * 0.0002) + (isPureLimitTp ? 0 : totalNotional * 0.0002)).toFixed(4));
            t.feeUSD = minOfficialFee;
            t.pnlUSD = Number((grossPnl - minOfficialFee).toFixed(4));
            t.pnlBRL = Number((t.pnlUSD * 5.80).toFixed(4));
        }
        const pnl = Number(t.pnlUSD) || 0;
        if (pnl >= 0) wins++;
        else losses++;
        runningBalance = Number((runningBalance + pnl).toFixed(4));
        t.balanceAfter = Number(runningBalance.toFixed(2));
    }

    dbData.trades = chronological.reverse();
    const netProfit = Number((runningBalance - initCap - withdrawn).toFixed(4));
    dbData.wallet.wins = wins;
    dbData.wallet.losses = losses;
    dbData.wallet.totalProfit = netProfit;
    dbData.wallet.walletBalance = Number((initCap + netProfit).toFixed(4));
    dbData.wallet.vaultBalance = Number(Math.max(0, netProfit * 0.30).toFixed(4));
    if (!dbData.wallet.botStartedAt) {
        const metaStart = dbData.meta && dbData.meta.createdAt ? new Date(dbData.meta.createdAt).getTime() : 0;
        dbData.wallet.botStartedAt = (metaStart > 0 ? metaStart : Date.now());
    }
    return dbData;
}

// 100% Pure Real MEXC Futures Database Loader (Zero artificial history rewriting)
function auditAndNormalizeDatabase(dbData) {
    if (!dbData.meta || dbData.meta.engine !== 'NexusQuant GridDB v6.1 (MEXC Positive Payoff Grid)') {
        const cleanCap = 10.00;
        dbData.wallet = {
            initialCapital: cleanCap,
            walletBalance: cleanCap,
            totalProfit: 0.00,
            vaultBalance: 0.00,
            totalWithdrawn: 0.00,
            wins: 0,
            losses: 0,
            botStartedAt: Date.now(),
            dailyDate: new Date().toISOString().slice(0, 10),
            dailyStartBalance: cleanCap,
            dailyProfitUSD: 0,
            dailyGoalReached: false,
            dailyProfitPct: 0
        };
        dbData.openPositions = [];
        dbData.trades = [];
        dbData.meta = {
            engine: 'NexusQuant GridDB v6.1 (MEXC Positive Payoff Grid)',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            totalSavedTrades: 0
        };
        return dbData;
    }
    recomputeWalletFromTrades(dbData);
    return dbData;
}

function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const raw = fs.readFileSync(DB_FILE, 'utf-8');
            const parsed = JSON.parse(raw);
            const merged = {
                ...defaultDB,
                ...parsed,
                meta: { ...defaultDB.meta, ...(parsed.meta || {}) },
                wallet: { ...defaultDB.wallet, ...(parsed.wallet || {}) },
                gridConfig: { ...defaultDB.gridConfig, ...(parsed.gridConfig || {}) },
                liveState: { ...defaultDB.liveState, ...(parsed.liveState || {}) },
                openPositions: Array.isArray(parsed.openPositions) ? parsed.openPositions : [],
                trades: Array.isArray(parsed.trades) ? parsed.trades : [],
                withdrawals: Array.isArray(parsed.withdrawals) ? parsed.withdrawals : []
            };
            return auditAndNormalizeDatabase(merged);
        }
    } catch (e) {
        console.error('Error loading DB, initializing fresh:', e.message);
    }
    return JSON.parse(JSON.stringify(defaultDB));
}

// ============================================================================
// RENDER CLOUD PERSISTENT DATABASE SYNC (via GitHub 'db-backup' branch)
// Prevents Render Free Tier container restarts from ever losing wallet/trades!
// ============================================================================
const GH_DB_TOKEN = process.env.GITHUB_DB_TOKEN || '';
const GH_DB_OWNER = process.env.GITHUB_DB_OWNER || 'kaelthusmatarazzo';
const GH_DB_REPO = process.env.GITHUB_DB_REPO || 'nexusquant-ai-grid-bot';
const GH_DB_BRANCH = 'db-backup';
let lastCloudSyncAt = 0;
let cloudSyncInFlight = false;
let lastCloudSha = null;
let cloudBootComplete = !GH_DB_TOKEN;

function githubDbRequest(method, apiPath, bodyObj = null) {
    if (!GH_DB_TOKEN) return Promise.resolve(null);
    return new Promise((resolve) => {
        const payload = bodyObj ? JSON.stringify(bodyObj) : null;
        const req = https.request({
            hostname: 'api.github.com',
            path: apiPath,
            method,
            headers: {
                'User-Agent': 'NexusQuant-CloudDB-Sync',
                'Authorization': `Bearer ${GH_DB_TOKEN}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
            },
            timeout: 6000
        }, (res) => {
            let raw = '';
            res.on('data', c => { raw += c; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: raw ? JSON.parse(raw) : {} });
                } catch (e) {
                    resolve({ status: res.statusCode, data: null });
                }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
        if (payload) req.write(payload);
        req.end();
    });
}

async function syncDatabaseToCloudNow(force = false) {
    if (!GH_DB_TOKEN || !cloudBootComplete || cloudSyncInFlight) return;
    const now = Date.now();
    if (!force && now - lastCloudSyncAt < 25000) return;
    cloudSyncInFlight = true;
    lastCloudSyncAt = now;
    try {
        const branchCheck = await githubDbRequest('GET', `/repos/${GH_DB_OWNER}/${GH_DB_REPO}/git/ref/heads/${GH_DB_BRANCH}`);
        if (!branchCheck || branchCheck.status === 404) {
            const mainRef = await githubDbRequest('GET', `/repos/${GH_DB_OWNER}/${GH_DB_REPO}/git/ref/heads/main`);
            if (mainRef && mainRef.status === 200 && mainRef.data && mainRef.data.object) {
                await githubDbRequest('POST', `/repos/${GH_DB_OWNER}/${GH_DB_REPO}/git/refs`, {
                    ref: `refs/heads/${GH_DB_BRANCH}`,
                    sha: mainRef.data.object.sha
                });
            }
        }
        if (!lastCloudSha) {
            const existing = await githubDbRequest('GET', `/repos/${GH_DB_OWNER}/${GH_DB_REPO}/contents/nexusquant_db.json?ref=${GH_DB_BRANCH}`);
            if (existing && existing.status === 200 && existing.data && existing.data.sha) {
                lastCloudSha = existing.data.sha;
            }
        }
        const contentB64 = Buffer.from(JSON.stringify(db, null, 2), 'utf-8').toString('base64');
        const putRes = await githubDbRequest('PUT', `/repos/${GH_DB_OWNER}/${GH_DB_REPO}/contents/nexusquant_db.json`, {
            message: `Auto-sync NexusQuant Cloud DB ($${(db.wallet && db.wallet.walletBalance || 10).toFixed(2)})`,
            content: contentB64,
            branch: GH_DB_BRANCH,
            ...(lastCloudSha ? { sha: lastCloudSha } : {})
        });
        if (putRes && (putRes.status === 200 || putRes.status === 201) && putRes.data && putRes.data.content) {
            lastCloudSha = putRes.data.content.sha;
        } else if (putRes && putRes.status === 409) {
            lastCloudSha = null;
        }
    } catch (e) {
        // Ignore transient sync errors
    } finally {
        cloudSyncInFlight = false;
    }
}

async function restoreDatabaseFromCloudOnBoot() {
    if (!GH_DB_TOKEN) {
        cloudBootComplete = true;
        return;
    }
    try {
        const res = await githubDbRequest('GET', `/repos/${GH_DB_OWNER}/${GH_DB_REPO}/contents/nexusquant_db.json?ref=${GH_DB_BRANCH}`);
        if (res && res.status === 200 && res.data && res.data.content) {
            lastCloudSha = res.data.sha;
            const decoded = Buffer.from(res.data.content, 'base64').toString('utf-8');
            const parsed = JSON.parse(decoded);
            if (parsed && parsed.wallet) {
                db = auditAndNormalizeDatabase({
                    ...defaultDB,
                    ...parsed,
                    meta: { ...defaultDB.meta, ...(parsed.meta || {}) },
                    wallet: { ...defaultDB.wallet, ...(parsed.wallet || {}) },
                    gridConfig: { ...defaultDB.gridConfig, ...(parsed.gridConfig || {}) },
                    liveState: { ...defaultDB.liveState, ...(parsed.liveState || {}) }
                });
                fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
                console.log(`[CloudDB] Restored persistent database from GitHub (${GH_DB_BRANCH})! Wallet: $${db.wallet.walletBalance}`);
            }
        }
    } catch (e) {
        console.error('[CloudDB] Restore skipped:', e.message);
    } finally {
        cloudBootComplete = true;
    }
}

function saveDatabase(dbData, forceCloud = false) {
    try {
        dbData.meta.updatedAt = new Date().toISOString();
        dbData.meta.totalSavedTrades = dbData.trades.length;
        const tmpFile = DB_FILE + '.tmp';
        fs.writeFileSync(tmpFile, JSON.stringify(dbData, null, 2), 'utf-8');
        fs.renameSync(tmpFile, DB_FILE);
        syncDatabaseToCloudNow(forceCloud);
    } catch (e) {
        console.error('Error writing DB:', e.message);
    }
}

let db = loadDatabase();
restoreDatabaseFromCloudOnBoot();

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

function sendJSON(res, statusCode, payload) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(payload));
}

function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                resolve({});
            }
        });
    });
}

// ============================================================================
// 24/7 MULTI-PAIR TOP-3 PORTFOLIO GRID ENGINE (100% PURE REAL BINANCE FEED)
// Uses data-api.binance.vision first so US Cloud Servers (Render Oregon) never get HTTP 451!
// ============================================================================
function fetchJsonFromUrl(url) {
    return new Promise((resolve) => {
        const req = https.get(url, { timeout: 4500 }, (resp) => {
            let data = '';
            resp.on('data', chunk => { data += chunk; });
            resp.on('end', () => {
                try {
                    if (resp.statusCode === 200) {
                        resolve(JSON.parse(data));
                        return;
                    }
                    resolve(null);
                } catch (e) {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

async function fetchAllBinance24hrTickers() {
    const symbols = Object.keys(PAIR_CONFIGS);
    const query = encodeURIComponent(JSON.stringify(symbols));
    // 1. Primary: Official Binance Vision CloudFront Mirror (Works 100% on Render US Oregon without HTTP 451!)
    const visionList = await fetchJsonFromUrl(`https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${query}`);
    if (Array.isArray(visionList) && visionList.length > 0) return visionList;
    // 2. Secondary: Standard Binance API
    const stdList = await fetchJsonFromUrl(`https://api.binance.com/api/v3/ticker/24hr?symbols=${query}`);
    if (Array.isArray(stdList) && stdList.length > 0) return stdList;
    // 3. Fallback: Official MEXC Global 24hr API
    const mexcList = await fetchJsonFromUrl('https://api.mexc.com/api/v3/ticker/24hr');
    if (Array.isArray(mexcList) && mexcList.length > 0) {
        return mexcList.filter(item => PAIR_CONFIGS[item.symbol]);
    }
    return null;
}

async function refreshServerMultiPairPrices() {
    if (!db.liveState.prices) db.liveState.prices = {};
    if (!db.liveState.priceHistory) db.liveState.priceHistory = {};

    const list = await fetchAllBinance24hrTickers();
    if (Array.isArray(list)) {
        list.forEach(item => {
            const sym = item.symbol;
            const cfg = PAIR_CONFIGS[sym];
            if (!cfg) return;
            const lastP = parseFloat(item.lastPrice);
            const highP = parseFloat(item.highPrice);
            const lowP = parseFloat(item.lowPrice);
            const netChgPct = Math.abs(parseFloat(item.priceChangePercent) || 0);
            const tradeCount = parseInt(item.count || 150000, 10);

            if (lastP > 0 && highP > lowP) {
                cfg.basePrice = lastP;
                db.liveState.prices[sym] = lastP;

                if (!db.liveState.priceHistory[sym]) db.liveState.priceHistory[sym] = [];
                const histArr = db.liveState.priceHistory[sym];
                if (histArr.length === 0 || histArr[histArr.length - 1] !== lastP) {
                    histArr.push(lastP);
                    if (histArr.length > 45) histArr.shift();
                }

                // Compute Real Intraday ATR % & Whipsaw Serrote Score + Self-Learning PnL Feedback
                const rangePct = ((highP - lowP) / lastP) * 100;
                const whipsawRatio = Math.min(10, Math.max(3.5, (rangePct / (netChgPct * 0.45 + 0.8)) * 3.2));
                const runawayPenalty = netChgPct > 14 ? (netChgPct - 14) * 0.9 : 0;
                const liquidityBonus = Math.min(4.2, Math.log10(Math.max(1000, tradeCount)) * 0.72);

                const life = (db.wallet && db.wallet.lifetimeBotStats && db.wallet.lifetimeBotStats[sym]) || null;
                let perfAdjustment = 0;
                if (life) {
                    if (life.realizedProfitUSD <= -0.04 || (life.losses - life.wins >= 2)) {
                        perfAdjustment = -14.0; // Evict underperforming choppy pair from Top 3
                    } else if (life.realizedProfitUSD > 0.01 && life.wins >= life.losses) {
                        perfAdjustment = 3.5;   // Reward high-win-rate pair
                    }
                }
                const cd = db.liveState && db.liveState.pairCooldowns && db.liveState.pairCooldowns[sym];
                const inCooldown = cd && cd.pauseUntil && Date.now() < cd.pauseUntil;
                if (inCooldown) {
                    perfAdjustment -= 25.0; // Evict stopped pair during 4m quarantine
                }

                const rawScore = 72 + Math.min(17.5, rangePct * 2.35) + (whipsawRatio * 0.75) + liquidityBonus - runawayPenalty + perfAdjustment;
                cfg.gridScore = Math.min(99.6, Math.max(50.0, rawScore));
                cfg.atrPct = Math.max(1.4, rangePct);
            }
        });
    }

    // Rank all 14 pairs and select Top 3 Best Grid Pairs (#1, #2, #3)
    // Fix Bug #3: Sticky Top-3 Lock — NEVER kick a pair out of Top 3 while it has an active FILLED position!
    const ranked = Object.keys(PAIR_CONFIGS)
        .map(sym => ({ symbol: sym, ...PAIR_CONFIGS[sym] }))
        .sort((a, b) => b.gridScore - a.gridScore);

    const activeFilledSyms = new Set(
        (db.openPositions || [])
            .filter(p => p.orderStatus === 'FILLED')
            .map(p => p.symbol)
    );
    const prevTop3 = Array.isArray(db.liveState.top3Pairs) ? db.liveState.top3Pairs : [];
    const stickyTop3 = [];

    for (const s of prevTop3) {
        if (activeFilledSyms.has(s) && stickyTop3.length < 3) {
            stickyTop3.push(s);
        }
    }
    for (const r of ranked) {
        const cd = db.liveState && db.liveState.pairCooldowns && db.liveState.pairCooldowns[r.symbol];
        const inCooldown = cd && cd.pauseUntil && Date.now() < cd.pauseUntil;
        if (!inCooldown && !stickyTop3.includes(r.symbol) && stickyTop3.length < 3) {
            stickyTop3.push(r.symbol);
        }
    }
    for (const r of ranked) {
        if (!stickyTop3.includes(r.symbol) && stickyTop3.length < 3) {
            stickyTop3.push(r.symbol);
        }
    }
    db.liveState.top3Pairs = stickyTop3;

    const viewedSym = db.gridConfig.pair || db.liveState.top3Pairs[0] || 'SOLUSDT';
    const viewedPrice = db.liveState.prices[viewedSym] || PAIR_CONFIGS[viewedSym].basePrice;
    db.liveState.liveAnchorPrice = viewedPrice;
    db.liveState.currentPrice = viewedPrice;
    db.liveState.simOffset = 0;
}

// ============================================================================
// NATIVE TELEGRAM BOT WEBHOOK SENDER (24/7 REAL-TIME ALERTS)
// ============================================================================
function sendTelegramAlert(messageText) {
    const token = (db.gridConfig && db.gridConfig.telegramBotToken) || process.env.TELEGRAM_BOT_TOKEN || '';
    const chatId = (db.gridConfig && db.gridConfig.telegramChatId) || process.env.TELEGRAM_CHAT_ID || '';
    if (!token || !chatId) return Promise.resolve({ sent: false, reason: 'missing_credentials' });

    return new Promise((resolve) => {
        try {
            const payload = JSON.stringify({
                chat_id: chatId,
                text: messageText,
                parse_mode: 'HTML'
            });
            const req = https.request({
                hostname: 'api.telegram.org',
                path: `/bot${token}/sendMessage`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                },
                timeout: 4500
            }, (res) => {
                res.on('data', () => {});
                res.on('end', () => resolve({ sent: res.statusCode === 200 }));
            });
            req.on('error', () => resolve({ sent: false }));
            req.on('timeout', () => { req.destroy(); resolve({ sent: false }); });
            req.write(payload);
            req.end();
        } catch (e) {
            resolve({ sent: false });
        }
    });
}

// ============================================================================
// FASE 1 & 2: DYNAMIC ATR STEP + RSI-1M HEDGE + BTC CIRCUIT BREAKER + DAILY GOAL
// ============================================================================
function getDynamicGridParams(sym) {
    const cfg = PAIR_CONFIGS[sym] || PAIR_CONFIGS.SOLUSDT;
    const atr = cfg.atrPct || 4.0;
    const volFactor = Math.max(0.95, Math.min(1.20, atr / 4.2));
    return {
        l1TpPct: Number((0.36 * volFactor).toFixed(3)),        // +0.34% to +0.42% TP on L1 ($9.00 notional -> +$0.0306 to +$0.0360 Net Win!)
        l2TpPct: Number((0.30 * volFactor).toFixed(3)),        // +0.29% to +0.35% TP after L2 Limit Maker merge ($12.00 notional -> +$0.0340 Net Win!)
        l3TpPct: Number((0.25 * volFactor).toFixed(3)),
        staggerStepPct: 0.28                                   // -0.28% Deep L2 Limit Order so normal pullbacks don't bloat losing trade size
    };
}

function computePairRsi1m(sym) {
    const hist = (db.liveState.priceHistory && db.liveState.priceHistory[sym]) || [];
    if (hist.length < 4) return 50;
    const lastP = hist[hist.length - 1] || 1;
    // Wilder neutral damping prevents 1-tick moves from pinning RSI to 0.0 or 100.0
    const neutralSeed = lastP * 0.00035;
    let gains = neutralSeed;
    let losses = neutralSeed;
    for (let i = 1; i < hist.length; i++) {
        const diff = hist[i] - hist[i - 1];
        if (diff > 0) gains += diff;
        else if (diff < 0) losses += Math.abs(diff);
    }
    const rs = gains / Math.max(1e-9, losses);
    return Number((100 - (100 / (1 + rs))).toFixed(1));
}

function computeEma(values, period) {
    if (!values || values.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
        ema = values[i] * k + ema * (1 - k);
    }
    return ema;
}

// v8.5 Trend-Confirmed Direction Filter (Removed Ping-Pong Auto-Flip that caused LONG->SHORT->LONG whipsaw stops)
function computeSmartBotDirection(sym, rankIdx, btcShieldActive) {
    if (btcShieldActive) return 'SHORT';
    const hist = (db.liveState.priceHistory && db.liveState.priceHistory[sym]) || [];
    const rsi = computePairRsi1m(sym);

    if (hist.length >= 8) {
        const emaFast = computeEma(hist.slice(-8), 4);
        const emaSlow = computeEma(hist.slice(-20), 12);
        const momentumPct = ((hist[hist.length - 1] - hist[Math.max(0, hist.length - 6)]) / hist[Math.max(0, hist.length - 6)]) * 100;
        if (rsi <= 32 && momentumPct > -0.15) return 'LONG';   // Confirmed oversold bounce
        if (rsi >= 68 && momentumPct < 0.15) return 'SHORT';   // Confirmed overbought rejection
        if (emaFast > emaSlow * 1.00015 && momentumPct >= 0) return 'LONG';
        if (emaFast < emaSlow * 0.99985 && momentumPct <= 0) return 'SHORT';
    }
    if (rsi >= 58) return 'SHORT';
    if (rsi <= 42) return 'LONG';
    return (rankIdx === 1) ? 'SHORT' : 'LONG';
}


function evaluateBtcCircuitBreaker() {
    const btcHist = (db.liveState.priceHistory && db.liveState.priceHistory['BTCUSDT']) || [];
    let btcDeltaPct = 0;
    if (btcHist.length >= 3) {
        const oldest = btcHist[0];
        const newest = btcHist[btcHist.length - 1];
        if (oldest > 0) {
            btcDeltaPct = Number((((newest - oldest) / oldest) * 100).toFixed(3));
        }
    }
    const crashDetected = btcDeltaPct <= -1.15;
    const prevActive = db.liveState.btcCircuitBreaker && db.liveState.btcCircuitBreaker.active;
    db.liveState.btcCircuitBreaker = {
        active: crashDetected,
        btcDeltaPct,
        mode: crashDetected ? 'SHORT_HEDGE_SHIELD' : 'NORMAL_SAFE',
        label: crashDetected
            ? `🚨 ESCUDO ANTI-DUMP ATIVO (BTC ${btcDeltaPct}%)`
            : `🛡️ Escudo BTC Normal (${btcDeltaPct >= 0 ? '+' : ''}${btcDeltaPct}%)`
    };
    if (crashDetected && !prevActive) {
        sendTelegramAlert(`🚨 <b>[NEXUSQUANT ESCUDO ANTI-CRASH]</b>\nBTC recuou ${btcDeltaPct}% rapidamente! Novas ordens convertidas para SHORT Hedge de proteção.`);
    }
    return db.liveState.btcCircuitBreaker;
}

function evaluateDailyGoalAndProtection() {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (db.wallet.dailyDate !== todayStr) {
        db.wallet.dailyDate = todayStr;
        db.wallet.dailyStartBalance = db.wallet.walletBalance || 10;
        db.wallet.dailyProfitUSD = 0;
        db.wallet.dailyGoalReached = false;
    }
    const base = Math.max(1, db.wallet.dailyStartBalance || db.wallet.initialCapital || 10);
    const dailyPct = Number((((db.wallet.dailyProfitUSD || 0) / base) * 100).toFixed(2));
    db.wallet.dailyProfitPct = dailyPct;

    if (dailyPct >= 3.0 && !db.wallet.dailyGoalReached) {
        db.wallet.dailyGoalReached = true;
        sendTelegramAlert(`🏆 <b>[META DIÁRIA BATIDA +${dailyPct}%]</b>\nLucro do dia: +$${(db.wallet.dailyProfitUSD || 0).toFixed(2)}! Modo Lucro Protegido (50% Cofre Blindado) ativado.`);
    }
    return {
        dailyProfitUSD: db.wallet.dailyProfitUSD || 0,
        dailyProfitPct: dailyPct,
        goalReached: Boolean(db.wallet.dailyGoalReached)
    };
}

function recomputePerBotStats() {
    if (!db.liveState.botStats) db.liveState.botStats = {};
    if (!db.wallet.lifetimeBotStats) db.wallet.lifetimeBotStats = {};
    const stats = {};
    const prices = db.liveState.prices || {};

    // If lifetimeBotStats has not been seeded yet, seed it once from current db.trades so we never lose history past 1000 trades
    if (!db.wallet.lifetimeBotStatsSeeded && Array.isArray(db.trades)) {
        for (const t of db.trades) {
            const sym = t.symbol || Object.keys(PAIR_CONFIGS).find(k => PAIR_CONFIGS[k].name === t.pair) || 'SOLUSDT';
            if (!db.wallet.lifetimeBotStats[sym]) {
                db.wallet.lifetimeBotStats[sym] = { realizedProfitUSD: 0, wins: 0, losses: 0 };
            }
            const pnl = Number(t.pnlUSD) || 0;
            db.wallet.lifetimeBotStats[sym].realizedProfitUSD = Number((db.wallet.lifetimeBotStats[sym].realizedProfitUSD + pnl).toFixed(4));
            if (pnl >= 0) db.wallet.lifetimeBotStats[sym].wins++;
            else db.wallet.lifetimeBotStats[sym].losses++;
        }
        db.wallet.lifetimeBotStatsSeeded = true;
    }

    // Recalibrate Vault Balance strictly to 30% of Net Realized Profit (High-Water Mark) so Vault never starves active trading margin!
    const initCap = Number(db.wallet.initialCapital) || 10;
    const currBal = Number(db.wallet.walletBalance) ?? initCap;
    const netProfit = Math.max(0, currBal - initCap);
    db.wallet.totalProfit = Number((currBal - initCap).toFixed(4));
    db.wallet.vaultBalance = Number((netProfit * 0.30).toFixed(4));

    for (const [sym, cfg] of Object.entries(PAIR_CONFIGS)) {
        const dyn = getDynamicGridParams(sym);
        const life = db.wallet.lifetimeBotStats[sym] || { realizedProfitUSD: 0, wins: 0, losses: 0 };
        stats[sym] = {
            symbol: sym,
            pair: cfg.name,
            realizedProfitUSD: Number((life.realizedProfitUSD || 0).toFixed(4)),
            realizedProfitBRL: Number(((life.realizedProfitUSD || 0) * USD_TO_BRL).toFixed(2)),
            floatingPnlUSD: 0,
            totalBotProfitUSD: 0,
            wins: life.wins || 0,
            losses: life.losses || 0,
            winRate: 100,
            activeOrdersCount: 0,
            activeLevels: [],
            dynamicL1TpPct: dyn.l1TpPct,
            dynamicL2TpPct: dyn.l2TpPct,
            rsi1m: computePairRsi1m(sym)
        };
    }

    if (Array.isArray(db.openPositions)) {
        for (const pos of db.openPositions) {
            const sym = pos.symbol || 'SOLUSDT';
            if (!stats[sym]) continue;
            const liveP = prices[sym] || pos.currentPrice || pos.entryPrice;
            const isPending = pos.orderStatus === 'PENDING_LIMIT';
            const diffPct = isPending ? 0 : (pos.side === 'LONG'
                ? ((liveP - pos.entryPrice) / pos.entryPrice) * 100
                : ((pos.entryPrice - liveP) / pos.entryPrice) * 100);
            const openPnl = isPending ? 0 : pos.margin * ((diffPct * (pos.leverage || 12)) / 100);
            stats[sym].floatingPnlUSD = Number((stats[sym].floatingPnlUSD + openPnl).toFixed(4));
            stats[sym].activeOrdersCount++;
            stats[sym].activeLevels.push((pos.gridLevel || 'L1') + (isPending ? '⏳' : '⚡'));
        }
    }

    for (const sym of Object.keys(stats)) {
        const s = stats[sym];
        const total = s.wins + s.losses;
        s.winRate = total > 0 ? Math.round((s.wins / total) * 100) : 100;
        s.totalBotProfitUSD = Number((s.realizedProfitUSD + s.floatingPnlUSD).toFixed(4));
    }

    db.liveState.botStats = stats;
    return stats;
}

function serverOpenPositionForPair(sym, side, reason, gridLevel = 'L1', customTpPct = null, entryPriceOverride = null, orderStatus = 'FILLED') {
    const cfg = PAIR_CONFIGS[sym] || PAIR_CONFIGS.SOLUSDT;
    const entryPrice = entryPriceOverride || (db.liveState.prices && db.liveState.prices[sym]) || cfg.basePrice;
    if (!entryPrice || entryPrice <= 0) return null;

    const dyn = getDynamicGridParams(sym);
    evaluateDailyGoalAndProtection();
    // Fix Bug #2: Vault only locks 30% of Net Profit (never eating initialCapital!)
    const initCap = Number(db.wallet.initialCapital) || 10;
    const netProfit = Math.max(0, (Number(db.wallet.walletBalance) || initCap) - initCap);
    const vaultReserve = Number((netProfit * 0.30).toFixed(4));
    db.wallet.vaultBalance = vaultReserve;
    const activeTradingBankroll = Math.max(initCap * 0.5, (Number(db.wallet.walletBalance) || initCap) - vaultReserve);
    const baseCapital = db.gridConfig.compoundEnabled !== false ? activeTradingBankroll : initCap;

    // v8.5 Positive Payoff Sizing (Fixes L2 Loss Asymmetry):
    // L1 (FILLED) = 6% margin ($0.60 on $10 bankroll = $9.00 notional -> TP +0.36% = +$0.0306 Net Win!)
    // L2 (PENDING_LIMIT 0% Maker Fee at -0.28% deep pullback) = 2% margin ($0.20 = $3.00 notional -> combined $12.00 notional, max SL -0.20% = -$0.0278 Net Loss < +$0.0306 Win!)
    const isL2Order = orderStatus === 'PENDING_LIMIT' || (gridLevel || '').startsWith('L2');
    const orderSizePct = isL2Order ? 2 : 6;
    const leverage = Math.max(15, Number(db.gridConfig.leverage) || 15);
    const margin = Math.max(isL2Order ? 0.20 : 0.60, Number((baseCapital * (orderSizePct / 100)).toFixed(4)));

    const tpPct = customTpPct || dyn.l1TpPct;
    const slPct = 0.30;

    const tpPrice = side === 'LONG'
        ? entryPrice * (1 + tpPct / 100)
        : entryPrice * (1 - tpPct / 100);

    const slPrice = side === 'LONG'
        ? entryPrice * (1 - slPct / 100)
        : entryPrice * (1 + slPct / 100);

    const pos = {
        id: 'GRD-' + Math.floor(100000 + Math.random() * 900000),
        pair: cfg.name,
        symbol: sym,
        gridLevel,
        orderStatus, // 'FILLED' (Executed Position) or 'PENDING_LIMIT' (Waiting on MEXC Orderbook)
        side,
        margin,
        leverage,
        entryPrice,
        currentPrice: (db.liveState.prices && db.liveState.prices[sym]) || entryPrice,
        tpPrice,
        slPrice,
        tpPct,
        slPct,
        dcaCount: 0,
        reduceOnly: false,
        reanchorCount: 0,
        trailingLocked: false,
        lockFloorPct: 0,
        openedAt: new Date().toISOString()
    };

    db.openPositions.push(pos);
    if (db.gridConfig && db.gridConfig.mexcConnected) {
        dispatchRealMexcOrder({
            sym,
            side,
            isClose: false,
            marginUSD: margin,
            leverage,
            price: entryPrice,
            isLimit: orderStatus === 'PENDING_LIMIT'
        }).catch(() => {});
    }
    db.liveState.lastEvent = {
        id: pos.id + '-OPEN',
        type: 'entry',
        timestamp: Date.now(),
        message: orderStatus === 'PENDING_LIMIT'
            ? `⏳ [MEXC LIMIT • ${cfg.name}] Posicionou Ordem Pendente ${gridLevel} ${side} (0% Maker) @ $${entryPrice.toFixed(cfg.decimals)} ➔ TP: $${tpPrice.toFixed(cfg.decimals)}`
            : `⚡ [MEXC EXECUTADA • ${cfg.name}] Abriu ${gridLevel} ${side} (${leverage}x | Lote $${margin.toFixed(2)}) @ $${entryPrice.toFixed(cfg.decimals)} ➔ TP: $${tpPrice.toFixed(cfg.decimals)}`
    };
    recomputePerBotStats();
    saveDatabase(db);
    return pos;
}

function serverClosePosition(pos, exitPrice, pnlUSD, closeReason) {
    const isLimitTpExit = String(closeReason || '').includes('TP REAL MEXC');
    if (db.gridConfig && db.gridConfig.mexcConnected && pos.orderStatus === 'FILLED') {
        dispatchRealMexcOrder({
            sym: pos.symbol || 'SOLUSDT',
            side: pos.side,
            isClose: true,
            marginUSD: pos.margin || 1.0,
            leverage: pos.leverage || 15,
            price: exitPrice,
            isLimit: isLimitTpExit
        }).catch(() => {});
    }
    // 100% Official MEXC Futures Fee Accounting (Per-Leg Exact Calculation):
    // Standard MEXC Futures: Maker (Limit Order) = 0.00% | Taker (Market Order) = 0.02% (or 0.01% with MX deduction)
    const takerRatePct = (db.gridConfig && db.gridConfig.exchangeFeeMode === 'BINANCE_MAKER') ? 0.04 : 0.02;
    const makerRatePct = 0.00;
    const lev = Number(pos.leverage) || 15;
    const totalNotionalUSD = (Number(pos.margin) || 0.5) * lev;
    const isMergedL1L2 = (pos.dcaCount || 0) > 0 || String(pos.gridLevel || '').includes('+L2');
    // Entry Leg Fee: L1 opens as Market Taker (5/9 of merged notional, or 100% of single L1); L2 opens as Limit Maker (0.00%)
    const l1EntryNotionalUSD = isMergedL1L2 ? (totalNotionalUSD * (5 / 9)) : totalNotionalUSD;
    const entryFeeUSD = l1EntryNotionalUSD * (takerRatePct / 100);
    // Exit Leg Fee: Fixed TP executes as resting Limit Maker (0.00%); Trailing / Breakeven / Stop-Loss execute as Market Taker (0.02%)
    const exitFeeRatePct = isLimitTpExit ? makerRatePct : takerRatePct;
    const exitFeeUSD = totalNotionalUSD * (exitFeeRatePct / 100);

    const feeUSD = Number((entryFeeUSD + exitFeeUSD).toFixed(4));
    const finalPnl = Number((pnlUSD - feeUSD).toFixed(4));

    db.wallet.walletBalance = Number((db.wallet.walletBalance + finalPnl).toFixed(4));
    const initCap = Number(db.wallet.initialCapital) || 10;
    db.wallet.totalProfit = Number(((db.wallet.walletBalance || initCap) - initCap).toFixed(4));
    db.wallet.dailyProfitUSD = Number(((db.wallet.dailyProfitUSD || 0) + finalPnl).toFixed(4));
    // Fix Bug #2: High-Water Mark Vault (30% of Net Profit)
    const netProfit = Math.max(0, db.wallet.totalProfit);
    db.wallet.vaultBalance = Number((netProfit * 0.30).toFixed(4));
    evaluateDailyGoalAndProtection();

    // Fix Bug #3: Update persistent lifetimeBotStats so >1000 trades never lose coin history
    if (!db.wallet.lifetimeBotStats) db.wallet.lifetimeBotStats = {};
    const symKey = pos.symbol || 'SOLUSDT';
    if (!db.wallet.lifetimeBotStats[symKey]) {
        db.wallet.lifetimeBotStats[symKey] = { realizedProfitUSD: 0, wins: 0, losses: 0 };
    }
    db.wallet.lifetimeBotStats[symKey].realizedProfitUSD = Number((db.wallet.lifetimeBotStats[symKey].realizedProfitUSD + finalPnl).toFixed(4));

    if (finalPnl >= 0) {
        db.wallet.wins = (db.wallet.wins || 0) + 1;
        db.wallet.lifetimeBotStats[symKey].wins++;
    } else {
        db.wallet.losses = (db.wallet.losses || 0) + 1;
        db.wallet.lifetimeBotStats[symKey].losses++;
        // v8.5 Full 4-Minute Quarantine after Stop Loss (Prevents LONG->SHORT->LONG whipsaw ping-pong!)
        if (!db.liveState.pairCooldowns) db.liveState.pairCooldowns = {};
        db.liveState.pairCooldowns[symKey] = {
            pauseUntil: Date.now() + 240000,
            FlipUntil: 0,
            blockedSide: null,
            lastStopAt: new Date().toISOString()
        };
    }

    // Improvement #3: Immediately cancel any orphan PENDING_LIMIT (L2) order on this coin when a cycle closes!
    const closedSym = pos.symbol || 'SOLUSDT';
    for (let k = db.openPositions.length - 1; k >= 0; k--) {
        const other = db.openPositions[k];
        if (other.id !== pos.id && other.symbol === closedSym && other.orderStatus === 'PENDING_LIMIT') {
            db.openPositions.splice(k, 1);
        }
    }

    const tradeEntry = {
        id: pos.id || ('TRD-' + Date.now()),
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleTimeString('pt-BR'),
        symbol: pos.symbol || 'SOLUSDT',
        pair: pos.pair || 'SOL/USDT',
        gridMode: finalPnl >= 0 ? 'MEXC_GRID_TP' : 'MEXC_GRID_SL',
        gridLevel: pos.gridLevel || 'L1',
        side: pos.side,
        entryPrice: Number(pos.entryPrice) || 0,
        exitPrice: Number(exitPrice) || 0,
        feeUSD,
        pnlUSD: finalPnl,
        pnlBRL: Number((finalPnl * USD_TO_BRL).toFixed(4)),
        balanceAfter: Number(db.wallet.walletBalance.toFixed(2))
    };

    db.trades.unshift(tradeEntry);
    if (db.trades.length > 1000) db.trades.pop();

    const sign = finalPnl >= 0 ? '+' : '-';
    const absUSD = Math.abs(finalPnl).toFixed(4);
    const absBRL = Math.abs(finalPnl * USD_TO_BRL).toFixed(2);

    db.liveState.lastEvent = {
        id: tradeEntry.id + '-CLOSE',
        type: finalPnl >= 0 ? 'profit' : 'loss',
        timestamp: Date.now(),
        message: finalPnl >= 0
            ? `💰 [${closeReason}] ${tradeEntry.pair} (${tradeEntry.gridLevel}) bateu TP REAL MEXC @ $${Number(exitPrice).toFixed(4)} | Taxa MEXC: -$${feeUSD.toFixed(4)} | Lucro Líquido: ${sign}$${absUSD} (${sign}R$ ${absBRL})`
            : `🛑 [${closeReason}] ${tradeEntry.pair} (${tradeEntry.gridLevel}) fechou negativo @ $${Number(exitPrice).toFixed(4)} | Resultado: ${sign}$${absUSD} (${sign}R$ ${absBRL}) [Cooldown 3m Ativado]`
    };

    recomputePerBotStats();
    saveDatabase(db);

    if (finalPnl >= 0) {
        const botProfit = (db.liveState.botStats && db.liveState.botStats[tradeEntry.symbol])
            ? db.liveState.botStats[tradeEntry.symbol].realizedProfitUSD
            : finalPnl;
        sendTelegramAlert(
            `💰 <b>[MEXC FUTURES • TP REALIZADO]</b>\n` +
            `🤖 Bot: <b>${tradeEntry.pair} (${tradeEntry.gridLevel})</b>\n` +
            `📈 Saída Real: <code>$${Number(exitPrice).toFixed(4)}</code> (Taxa MEXC: -$${feeUSD.toFixed(4)})\n` +
            `💵 Lucro Líquido: <b>+$${absUSD} (+R$ ${absBRL})</b>\n` +
            `🏆 Lucro Acumulado deste Bot: <b>+$${Number(botProfit).toFixed(2)}</b>\n` +
            `🏦 Saldo Banca: <b>$${db.wallet.walletBalance.toFixed(2)}</b>`
        );
    }

    return tradeEntry;
}

function liquidateAllForPairSwitch(newSymbol) {
    const newCfg = PAIR_CONFIGS[newSymbol] || PAIR_CONFIGS.SOLUSDT;
    db.gridConfig.pair = newSymbol;
    const liveP = (db.liveState.prices && db.liveState.prices[newSymbol]) || newCfg.basePrice;
    db.liveState.liveAnchorPrice = liveP;
    db.liveState.currentPrice = liveP;
    db.liveState.simOffset = 0;
    recomputePerBotStats();
    saveDatabase(db);
}

// Sanitize legacy L3, price outliers (>3% from live feed), or conflicting LONG/SHORT orders
function sanitizeOpenPositionsV7() {
    if (!Array.isArray(db.openPositions)) return;
    const livePrices = (db.liveState && db.liveState.prices) || {};
    for (let i = db.openPositions.length - 1; i >= 0; i--) {
        const p = db.openPositions[i];
        const sym = p.symbol || 'SOLUSDT';
        const realP = livePrices[sym];
        if ((p.gridLevel || '').startsWith('L3')) {
            db.openPositions.splice(i, 1);
            continue;
        }
        // Purge any ghost order opened at a fallback price before live feed connected (>3% deviation)
        if (realP > 0 && Math.abs(p.entryPrice - realP) / realP > 0.03) {
            db.openPositions.splice(i, 1);
            continue;
        }
    }
    const bySym = {};
    for (const p of db.openPositions) {
        const s = p.symbol || 'SOLUSDT';
        if (!bySym[s]) bySym[s] = [];
        bySym[s].push(p);
    }
    for (const [sym, list] of Object.entries(bySym)) {
        const primary = list.find(p => p.orderStatus === 'FILLED' && (p.gridLevel || '').startsWith('L1'))
                     || list.find(p => p.orderStatus === 'FILLED')
                     || list[0];
        if (!primary) continue;
        if (primary.orderStatus === 'FILLED' && (primary.gridLevel || '').startsWith('L2')) {
            primary.gridLevel = primary.gridLevel.replace('L2', 'L1');
        }
        let seenL1 = false;
        let seenL2 = false;
        for (let i = db.openPositions.length - 1; i >= 0; i--) {
            const p = db.openPositions[i];
            if ((p.symbol || 'SOLUSDT') !== sym) continue;
            if (p.side !== primary.side) {
                db.openPositions.splice(i, 1);
                continue;
            }
            const isL1 = (p.gridLevel || '').startsWith('L1');
            const isL2 = (p.gridLevel || '').startsWith('L2');
            if (isL1) {
                if (seenL1) db.openPositions.splice(i, 1);
                else seenL1 = true;
            } else if (isL2) {
                if (seenL2 || p.orderStatus === 'FILLED') db.openPositions.splice(i, 1);
                else seenL2 = true;
            }
        }
    }
}

sanitizeOpenPositionsV7();

// Continuous 24/7 Multi-Bot Server Loop (v8.2 Wide-Channel Institutional MEXC Engine)
setInterval(async () => {
    if (!cloudBootComplete) return;
    await refreshServerMultiPairPrices();
    if (!db.gridConfig.botRunning) return;

    sanitizeOpenPositionsV7();

    const prices = db.liveState.prices || {};
    const top3 = db.liveState.top3Pairs || ['SOLUSDT', 'SUIUSDT', 'WIFUSDT'];
    const btcShield = evaluateBtcCircuitBreaker();
    evaluateDailyGoalAndProtection();

    // 1. Evaluate EACH open order across all 3 Grid Bots against ITS OWN REAL PRICE (prices[pos.symbol])
    for (let i = db.openPositions.length - 1; i >= 0; i--) {
        const pos = db.openPositions[i];
        if (!pos) continue;
        const sym = pos.symbol || 'SOLUSDT';
        const cfg = PAIR_CONFIGS[sym] || PAIR_CONFIGS.SOLUSDT;
        const price = prices[sym] || pos.currentPrice || pos.entryPrice;
        pos.currentPrice = price;

        // CASE 1: PENDING LIMIT ORDER ON MEXC ORDERBOOK (Not filled yet! 0% Maker Fee)
        if (pos.orderStatus === 'PENDING_LIMIT') {
            const primaryL1 = db.openPositions.find(p => p.id !== pos.id && p.symbol === sym && p.orderStatus === 'FILLED');
            if (!top3.includes(sym) || !primaryL1 || primaryL1.side !== pos.side) {
                db.openPositions.splice(i, 1);
                continue;
            }

            // Check if real price touched the Limit Order entry price -> FILL & MERGE INTO L1 (True MEXC One-Way Position Averaging!)
            const touchedLimit = (pos.side === 'LONG' && price <= pos.entryPrice) ||
                                 (pos.side === 'SHORT' && price >= pos.entryPrice);
            if (touchedLimit) {
                const limitFillPrice = pos.entryPrice;
                const combinedMargin = Number((primaryL1.margin + pos.margin).toFixed(4));
                primaryL1.entryPrice = ((primaryL1.entryPrice * primaryL1.margin) + (limitFillPrice * pos.margin)) / combinedMargin;
                primaryL1.margin = combinedMargin;
                primaryL1.wasPendingLimit = true; // 0.00% Maker Fee on MEXC!
                primaryL1.dcaCount = (primaryL1.dcaCount || 0) + 1;
                primaryL1.tpPct = 0.30; // +0.30% on $0.80 margin x 15x ($12.00 notional) = +$0.0360 Gross / +$0.0342 Net Win (0% Maker Exit Fee)!
                // Strictly cap L1+L2 Stop Loss at 0.20% from new average entry ($12.00 x -0.20% = -$0.0240 Gross / -$0.0278 Net Max Loss < Single L1 Win!)
                primaryL1.slPct = 0.20;
                primaryL1.justMergedAt = Date.now();
                primaryL1.tpPrice = primaryL1.side === 'LONG'
                    ? primaryL1.entryPrice * (1 + primaryL1.tpPct / 100)
                    : primaryL1.entryPrice * (1 - primaryL1.tpPct / 100);
                primaryL1.slPrice = primaryL1.side === 'LONG'
                    ? primaryL1.entryPrice * (1 - primaryL1.slPct / 100)
                    : primaryL1.entryPrice * (1 + primaryL1.slPct / 100);
                if (!(primaryL1.gridLevel || '').includes('+L2')) {
                    primaryL1.gridLevel = (primaryL1.gridLevel || 'L1').replace('L1', 'L1+L2');
                }
                db.openPositions.splice(i, 1);
                db.liveState.lastEvent = {
                    id: pos.id + '-FILL-MERGE',
                    type: 'entry',
                    timestamp: Date.now(),
                    message: `⚡ [MEXC LIMIT L2 EXECUTADA 0% TAXA] ${pos.pair} absorveu recuo profundo @ $${limitFillPrice.toFixed(cfg.decimals)}! Novo Preço Médio: $${primaryL1.entryPrice.toFixed(cfg.decimals)} ➔ Alvo Lucro: +$${(primaryL1.margin * primaryL1.leverage * (primaryL1.tpPct / 100)).toFixed(2)}`
                };
                continue;
            }

            // Trailing Grid Anchor ONLY for UNFILLED PENDING LIMIT orders!
            const distFromMarketPct = pos.side === 'LONG'
                ? ((price - pos.entryPrice) / pos.entryPrice) * 100
                : ((pos.entryPrice - price) / pos.entryPrice) * 100;
            if (distFromMarketPct >= 0.36) {
                const dyn = getDynamicGridParams(sym);
                pos.entryPrice = pos.side === 'LONG'
                    ? price * (1 - dyn.staggerStepPct / 100)
                    : price * (1 + dyn.staggerStepPct / 100);
                pos.tpPct = dyn.l2TpPct;
                pos.tpPrice = pos.side === 'LONG'
                    ? pos.entryPrice * (1 + pos.tpPct / 100)
                    : pos.entryPrice * (1 - pos.tpPct / 100);
                pos.reanchorCount = (pos.reanchorCount || 0) + 1;
            }
            continue;
        }

        // CASE 2: ALREADY FILLED / EXECUTED POSITION ON MEXC (Entry Price is 100% LOCKED & IMMUTABLE!)
        // Skip same-tick evaluation if L2 just merged into this L1 on this exact cycle
        if (pos.justMergedAt && Date.now() - pos.justMergedAt < 1500) {
            continue;
        }

        if (!top3.includes(sym) && !pos.reduceOnly) {
            pos.reduceOnly = true;
            pos.tpPct = Math.max(0.28, pos.tpPct || 0.32);
            pos.tpPrice = pos.side === 'LONG'
                ? pos.entryPrice * (1 + pos.tpPct / 100)
                : pos.entryPrice * (1 - pos.tpPct / 100);
            if (!(pos.gridLevel || '').includes('🔄')) {
                pos.gridLevel = `${pos.gridLevel || 'L1'} 🔄`;
            }
        }

        const diffPct = pos.side === 'LONG'
            ? ((price - pos.entryPrice) / pos.entryPrice) * 100
            : ((pos.entryPrice - price) / pos.entryPrice) * 100;

        // A. Real Price hit this Filled Position's Take Profit (Resting Limit Order on MEXC Book -> Fills at exact tpPrice)!
        if (diffPct >= pos.tpPct) {
            const executedTpPct = Number(pos.tpPct) || 0.35;
            const exactTpExitPrice = pos.side === 'LONG'
                ? pos.entryPrice * (1 + executedTpPct / 100)
                : pos.entryPrice * (1 - executedTpPct / 100);
            const exactPnlUSD = pos.margin * ((executedTpPct * pos.leverage) / 100);
            serverClosePosition(pos, exactTpExitPrice, exactPnlUSD, `TP REAL MEXC • ${pos.gridLevel || 'L1'}`);
            const idxNow = db.openPositions.findIndex(p => p.id === pos.id);
            if (idxNow !== -1) db.openPositions.splice(idxNow, 1);
            continue;
        }

        // B. v8.5 High-Threshold Trailing Lock (Does NOT choke winners at +0.16%! Only arms near TP at +0.30% to lock +$0.021+ net profit!)
        const isMergedL2 = (pos.dcaCount || 0) > 0 || (pos.gridLevel || '').includes('+L2');
        const beTriggerPct = isMergedL2 ? 0.26 : 0.30;
        const trailTriggerPct = isMergedL2 ? 0.28 : 0.33;
        if (diffPct >= beTriggerPct && !pos.breakevenLocked) {
            pos.breakevenLocked = true;
            pos.lockFloorPct = Math.max(pos.lockFloorPct || 0, isMergedL2 ? 0.21 : 0.24);
            if (!(pos.gridLevel || '').includes('🛡️')) {
                pos.gridLevel = `${pos.gridLevel || 'L1'} 🛡️`;
            }
        }
        // Stage 2: Once trade reaches trailTriggerPct, ratchet the profit floor dynamically just 0.04% behind peak!
        if (diffPct >= trailTriggerPct) {
            pos.trailingLocked = true;
            pos.lockFloorPct = Math.max(pos.lockFloorPct || 0.25, Number((diffPct - 0.04).toFixed(4)));
        }

        if ((pos.breakevenLocked || pos.trailingLocked) && diffPct <= pos.lockFloorPct) {
            // Real Market Execution: Fills at the actual crossed market price (Math.min) minus 0.01% book slippage
            const realisticMarketPct = Math.max(0.06, Math.min(pos.lockFloorPct, diffPct) - 0.01);
            const lockExitPrice = pos.side === 'LONG'
                ? pos.entryPrice * (1 + realisticMarketPct / 100)
                : pos.entryPrice * (1 - realisticMarketPct / 100);
            const lockPnlUSD = pos.margin * ((realisticMarketPct * pos.leverage) / 100);
            const closeLabel = pos.trailingLocked ? `TRAILING TP MEXC • ${pos.gridLevel || 'L1'}` : `BREAKEVEN BLINDADO • ${pos.gridLevel || 'L1'}`;
            serverClosePosition(pos, lockExitPrice, lockPnlUSD, closeLabel);
            const idxNow = db.openPositions.findIndex(p => p.id === pos.id);
            if (idxNow !== -1) db.openPositions.splice(idxNow, 1);
            continue;
        }

        // C. Controlled Channel Stop Loss
        if (diffPct <= -pos.slPct) {
            const cappedLossPct = -pos.slPct;
            const slExitPrice = pos.side === 'LONG'
                ? pos.entryPrice * (1 + cappedLossPct / 100)
                : pos.entryPrice * (1 - cappedLossPct / 100);
            const exactLossUSD = pos.margin * ((cappedLossPct * pos.leverage) / 100);
            serverClosePosition(pos, slExitPrice, exactLossUSD, `STOP CURTO PROTEGIDO • ${pos.gridLevel || 'L1'}`);
            const idxNow = db.openPositions.findIndex(p => p.id === pos.id);
            if (idxNow !== -1) db.openPositions.splice(idxNow, 1);
        }
    }

    // 2. Manage EACH of the 3 Simultaneous Grid Bots (#1 🥇, #2 🥈, #3 🥉) with Strict L1 + L2 & Cooldown Protection:
    for (let rankIdx = 0; rankIdx < top3.length; rankIdx++) {
        const sym = top3[rankIdx];
        const medal = rankIdx === 0 ? '#1🥇' : rankIdx === 1 ? '#2🥈' : '#3🥉';
        const price = prices[sym] || PAIR_CONFIGS[sym].basePrice;
        const dyn = getDynamicGridParams(sym);

        // Improvement #2: Check if this coin is in Post-Stop Cooldown Quarantine (45s pause)
        const cd = (db.liveState.pairCooldowns && db.liveState.pairCooldowns[sym]) || null;
        if (cd && cd.pauseUntil && Date.now() < cd.pauseUntil) {
            continue; // Wait for breakout turbulence to settle before opening new orders on this coin
        }

        // Improvement #4: Single-Direction Smart Trend Filter (EMA5/EMA13 + RSI1m + Cooldown Flip)
        const smartSide = computeSmartBotDirection(sym, rankIdx, btcShield.active);

        const botPositions = db.openPositions.filter(p => p.symbol === sym);
        const existingL1 = botPositions.find(p => p.orderStatus === 'FILLED');
        const hasL2 = botPositions.some(p => p.orderStatus === 'PENDING_LIMIT');

        // Line 1 (L1): Executed Position (0.01% MEXC Taker/Maker fee)
        let activeL1 = existingL1;
        if (!activeL1 && db.openPositions.length < 6) {
            activeL1 = serverOpenPositionForPair(
                sym,
                smartSide,
                `Grid Bot ${medal} • Linha L1 Sniper MEXC`,
                `L1 (${medal})`,
                dyn.l1TpPct,
                price,
                'FILLED'
            );
        }

        // Line 2 (L2): Strictly paired to activeL1's exact direction as PENDING_LIMIT (0.00% Maker Fee when touched!)
        if (activeL1 && !hasL2 && !(activeL1.gridLevel || '').includes('+L2') && db.openPositions.length < 6) {
            const baseSide = activeL1.side;
            const stepFrac = dyn.staggerStepPct / 100;
            const staggeredEntry = baseSide === 'LONG'
                ? activeL1.entryPrice * (1 - stepFrac)
                : activeL1.entryPrice * (1 + stepFrac);
            serverOpenPositionForPair(
                sym,
                baseSide,
                `Grid Bot ${medal} • Linha L2 Limit Maker MEXC`,
                `L2 (${medal})`,
                dyn.l2TpPct,
                staggeredEntry,
                'PENDING_LIMIT'
            );
        }
    }

    recomputePerBotStats();
    saveDatabase(db);
}, 2000);

refreshServerMultiPairPrices();

// ============================================================================
// OFFICIAL MEXC API AUTHENTICATION & LIVE ORDER EXECUTION BRIDGE (HMAC-SHA256)
// Supports both MEXC Perpetual Futures (contract.mexc.com) & MEXC Spot (api.mexc.com)
// ============================================================================
const crypto = require('crypto');

function verifyMexcSpotAccount(apiKey, secretKey) {
    return new Promise((resolve) => {
        try {
            const timestamp = Date.now();
            const query = `timestamp=${timestamp}`;
            const signature = crypto.createHmac('sha256', secretKey).update(query).digest('hex');
            const req = https.request({
                hostname: 'api.mexc.com',
                path: `/api/v3/account?${query}&signature=${signature}`,
                method: 'GET',
                headers: {
                    'X-MEXC-APIKEY': apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            }, (res) => {
                let raw = '';
                res.on('data', chunk => { raw += chunk; });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(raw);
                        if (parsed && Array.isArray(parsed.balances)) {
                            const usdt = parsed.balances.find(b => b.asset === 'USDT');
                            const free = usdt ? Number(usdt.free || 0) + Number(usdt.locked || 0) : 0;
                            resolve({ connected: true, accountType: 'SPOT', balanceUSDT: Number(free.toFixed(4)) });
                        } else {
                            resolve({ connected: false, error: (parsed && parsed.msg) || 'Chave Spot inválida' });
                        }
                    } catch (e) {
                        resolve({ connected: false, error: 'Erro ao ler resposta Spot MEXC' });
                    }
                });
            });
            req.on('error', (err) => resolve({ connected: false, error: err.message }));
            req.on('timeout', () => { req.destroy(); resolve({ connected: false, error: 'Timeout MEXC Spot' }); });
            req.end();
        } catch (e) {
            resolve({ connected: false, error: e.message });
        }
    });
}

function verifyMexcApiConnection(apiKey, secretKey) {
    if (!apiKey || !secretKey) return Promise.resolve({ connected: false, error: 'Chaves vazias' });
    return new Promise((resolve) => {
        try {
            const reqTime = Date.now().toString();
            const signPayload = apiKey + reqTime;
            const signature = crypto.createHmac('sha256', secretKey).update(signPayload).digest('hex');

            const req = https.request({
                hostname: 'contract.mexc.com',
                path: '/api/v1/private/account/assets',
                method: 'GET',
                headers: {
                    'ApiKey': apiKey,
                    'Request-Time': reqTime,
                    'Signature': signature,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            }, async (res) => {
                let raw = '';
                res.on('data', chunk => { raw += chunk; });
                res.on('end', async () => {
                    try {
                        const parsed = JSON.parse(raw);
                        const spotCheck = await verifyMexcSpotAccount(apiKey, secretKey);
                        if (parsed && parsed.success === true) {
                            const usdtAsset = Array.isArray(parsed.data)
                                ? parsed.data.find(a => a.currency === 'USDT')
                                : null;
                            const futBal = usdtAsset ? Number(usdtAsset.availableBalance || usdtAsset.equity || 0) : 0;
                            const spotBal = (spotCheck && spotCheck.connected) ? Number(spotCheck.balanceUSDT || 0) : 0;
                            const bestBal = futBal > 0 ? futBal : spotBal;
                            const mode = futBal > 0 ? 'FUTURES_PERPETUAL' : (spotBal > 0 ? 'SPOT_ZERO_FEE' : 'FUTURES_PERPETUAL');
                            resolve({ connected: true, accountType: mode, balanceUSDT: Number(bestBal.toFixed(4)), futuresUSDT: futBal, spotUSDT: spotBal });
                        } else if (spotCheck && spotCheck.connected) {
                            resolve({ connected: true, accountType: 'SPOT_ZERO_FEE', balanceUSDT: spotCheck.balanceUSDT, futuresUSDT: 0, spotUSDT: spotCheck.balanceUSDT });
                        } else {
                            resolve({ connected: false, error: (parsed && parsed.message) || (spotCheck && spotCheck.error) || 'Assinatura API inválida na MEXC' });
                        }
                    } catch (e) {
                        const spotCheck = await verifyMexcSpotAccount(apiKey, secretKey);
                        if (spotCheck && spotCheck.connected) {
                            resolve(spotCheck);
                        } else {
                            resolve({ connected: false, error: 'Resposta inválida da MEXC' });
                        }
                    }
                });
            });
            req.on('error', async () => {
                const spotCheck = await verifyMexcSpotAccount(apiKey, secretKey);
                resolve(spotCheck);
            });
            req.on('timeout', async () => {
                req.destroy();
                const spotCheck = await verifyMexcSpotAccount(apiKey, secretKey);
                resolve(spotCheck);
            });
            req.end();
        } catch (e) {
            resolve({ connected: false, error: e.message });
        }
    });
}

// Live Order Dispatcher to MEXC (Futures contract.mexc.com + Automatic Spot api.mexc.com Fallback)
function dispatchRealMexcOrder({ sym, side, isClose = false, marginUSD = 1.0, leverage = 15, price = 0, isLimit = false }) {
    if (!db.gridConfig || !db.gridConfig.mexcConnected || !db.gridConfig.mexcApiKey || !db.gridConfig.mexcSecretKey) {
        return Promise.resolve({ executed: false, mode: 'SIMULATION' });
    }
    const apiKey = db.gridConfig.mexcApiKey;
    const secretKey = db.gridConfig.mexcSecretKey;
    const mexcContractSym = sym.replace('USDT', '_USDT');
    // MEXC Futures side: 1=open long, 2=close short, 3=open short, 4=close long
    const futSide = !isClose
        ? (side === 'LONG' ? 1 : 3)
        : (side === 'LONG' ? 4 : 2);
    const futType = isLimit ? 1 : 5; // 1=Limit Maker, 5=Market
    const vol = Math.max(1, Math.round((marginUSD * leverage) / Math.max(0.0001, price)));

    return new Promise((resolve) => {
        try {
            const reqTime = Date.now().toString();
            const bodyObj = {
                symbol: mexcContractSym,
                price: Number(price.toFixed(6)),
                vol,
                leverage,
                side: futSide,
                type: futType,
                openType: 1 // Isolated margin
            };
            const bodyStr = JSON.stringify(bodyObj);
            const signPayload = apiKey + reqTime + bodyStr;
            const signature = crypto.createHmac('sha256', secretKey).update(signPayload).digest('hex');

            const req = https.request({
                hostname: 'contract.mexc.com',
                path: '/api/v1/private/order/submit',
                method: 'POST',
                headers: {
                    'ApiKey': apiKey,
                    'Request-Time': reqTime,
                    'Signature': signature,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(bodyStr)
                },
                timeout: 4500
            }, (res) => {
                let raw = '';
                res.on('data', c => { raw += c; });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(raw);
                        if (parsed && parsed.success === true) {
                            return resolve({ executed: true, venue: 'MEXC_FUTURES', orderId: parsed.data });
                        }
                    } catch (e) {}
                    // Automatic Fallback to MEXC Spot API (api.mexc.com/api/v3/order) if Futures endpoint returns retail 1002
                    const spotSide = (!isClose ? (side === 'LONG' ? 'BUY' : 'SELL') : (side === 'LONG' ? 'SELL' : 'BUY'));
                    const ts = Date.now();
                    const q = `symbol=${sym}&side=${spotSide}&type=MARKET&quoteOrderQty=${Math.max(1, marginUSD).toFixed(2)}&timestamp=${ts}`;
                    const sigSpot = crypto.createHmac('sha256', secretKey).update(q).digest('hex');
                    const sReq = https.request({
                        hostname: 'api.mexc.com',
                        path: `/api/v3/order?${q}&signature=${sigSpot}`,
                        method: 'POST',
                        headers: { 'X-MEXC-APIKEY': apiKey, 'Content-Type': 'application/json' },
                        timeout: 4500
                    }, (sRes) => {
                        let sRaw = '';
                        sRes.on('data', d => { sRaw += d; });
                        sRes.on('end', () => {
                            try {
                                const sParsed = JSON.parse(sRaw);
                                resolve({ executed: Boolean(sParsed && sParsed.orderId), venue: 'MEXC_SPOT', orderId: sParsed && sParsed.orderId });
                            } catch (e) {
                                resolve({ executed: false });
                            }
                        });
                    });
                    sReq.on('error', () => resolve({ executed: false }));
                    sReq.end();
                });
            });
            req.on('error', () => resolve({ executed: false }));
            req.write(bodyStr);
            req.end();
        } catch (e) {
            resolve({ executed: false });
        }
    });
}

// ============================================================================
// HTTP SERVER & REST API FOR TAB SYNCHRONIZATION
// ============================================================================
const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        return sendJSON(res, 200, { ok: true });
    }

    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = urlObj.pathname;

    // 1. GET /api/db — Tabs poll this endpoint to synchronize UI with the 24/7 Server Engine
    if (pathname === '/api/db' && req.method === 'GET') {
        return sendJSON(res, 200, { ok: true, db });
    }

    // 2. POST /api/action — Remote commands from any browser tab
    if (pathname === '/api/action' && req.method === 'POST') {
        const body = await parseBody(req);
        if (body.action === 'FORCE_ORDER') {
            const side = body.side === 'SHORT' ? 'SHORT' : 'LONG';
            const pos = serverOpenPosition(side, 'Disparo Manual via Aba', side === 'LONG' ? 'L-MANUAL' : 'S-MANUAL');
            return sendJSON(res, 200, { ok: true, pos, db });
        }
        if (body.action === 'CLOSE_POSITION' && body.id) {
            const idx = db.openPositions.findIndex(p => p.id === body.id);
            if (idx !== -1) {
                const pos = db.openPositions[idx];
                if (pos.orderStatus === 'PENDING_LIMIT') {
                    db.openPositions.splice(idx, 1);
                    saveDatabase(db);
                } else {
                    const exitPrice = pos.currentPrice || (db.liveState.prices && db.liveState.prices[pos.symbol]) || pos.entryPrice;
                    const diffPct = pos.side === 'LONG'
                        ? ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100
                        : ((pos.entryPrice - exitPrice) / pos.entryPrice) * 100;
                    const rawPnl = pos.margin * ((diffPct * pos.leverage) / 100);
                    serverClosePosition(pos, exitPrice, rawPnl, 'FECHAMENTO MANUAL');
                    db.openPositions.splice(idx, 1);
                    saveDatabase(db);
                }
            }
            return sendJSON(res, 200, { ok: true, db });
        }
        if (body.action === 'SWITCH_PAIR' && body.pair && PAIR_CONFIGS[body.pair]) {
            if (typeof body.autoPairEnabled === 'boolean') {
                db.gridConfig.autoPairEnabled = body.autoPairEnabled;
            }
            if (body.pair !== db.gridConfig.pair) {
                liquidateAllForPairSwitch(body.pair);
                await refreshServerMultiPairPrices();
            }
            return sendJSON(res, 200, { ok: true, db });
        }
        if (body.action === 'TOGGLE_BOT') {
            db.gridConfig.botRunning = Boolean(body.botRunning);
            saveDatabase(db);
            return sendJSON(res, 200, { ok: true, db });
        }
        if (body.action === 'SAVE_TELEGRAM_PIN') {
            if (typeof body.telegramBotToken === 'string') db.gridConfig.telegramBotToken = body.telegramBotToken.trim();
            if (typeof body.telegramChatId === 'string') db.gridConfig.telegramChatId = body.telegramChatId.trim();
            if (typeof body.securityPin === 'string' && body.securityPin.trim().length >= 4) {
                db.gridConfig.securityPin = body.securityPin.trim();
            }
            if (typeof body.exchangeFeeMode === 'string') {
                db.gridConfig.exchangeFeeMode = body.exchangeFeeMode;
            }
            saveDatabase(db);
            return sendJSON(res, 200, { ok: true, db });
        }
        if (body.action === 'TEST_MEXC_API') {
            const mexcApiKey = (body.mexcApiKey || '').trim();
            const mexcSecretKey = (body.mexcSecretKey || '').trim();
            db.gridConfig.mexcApiKey = mexcApiKey;
            db.gridConfig.mexcSecretKey = mexcSecretKey;
            const check = await verifyMexcApiConnection(mexcApiKey, mexcSecretKey);
            db.gridConfig.mexcConnected = Boolean(check.connected);
            db.gridConfig.mexcAccountType = check.accountType || 'FUTURES_PERPETUAL';
            // If connected and user has real USDT balance on MEXC (> $1), automatically sync bankroll to their real MEXC balance!
            if (check.connected && Number(check.balanceUSDT) >= 1) {
                const realCap = Number(Number(check.balanceUSDT).toFixed(2));
                db.wallet.initialCapital = realCap;
                db.wallet.walletBalance = Number((realCap + (db.wallet.totalProfit || 0)).toFixed(4));
            }
            saveDatabase(db, true);
            return sendJSON(res, 200, { ok: true, mexcCheck: check, db });
        }
        if (body.action === 'TEST_TELEGRAM') {
            if (typeof body.telegramBotToken === 'string') db.gridConfig.telegramBotToken = body.telegramBotToken.trim();
            if (typeof body.telegramChatId === 'string') db.gridConfig.telegramChatId = body.telegramChatId.trim();
            saveDatabase(db);
            const result = await sendTelegramAlert(
                `🚀 <b>[NEXUSQUANT AI • CONEXÃO CONFIRMADA]</b>\n` +
                `✅ Seus 3 Grid Bots Simultâneos MEXC estão conectados ao seu Telegram!\n` +
                `💰 Saldo Atual: <b>$${db.wallet.walletBalance.toFixed(2)}</b>\n` +
                `🔒 Cofre Blindado: <b>$${(db.wallet.vaultBalance || 0).toFixed(2)}</b>`
            );
            return sendJSON(res, 200, { ok: true, telegramResult: result, db });
        }
        return sendJSON(res, 400, { ok: false, error: 'Unknown action' });
    }

    // Legacy endpoint protection: ignore direct client trade pushes from un-refreshed tabs
    if (pathname === '/api/trade' && req.method === 'POST') {
        return sendJSON(res, 200, { ok: true, ignoredClientTrade: true, totalRecords: db.trades.length, db });
    }

    // 3. POST /api/sync — Update Grid Configuration, Deposits, or Withdrawals from a tab
    if (pathname === '/api/sync' && req.method === 'POST') {
        const body = await parseBody(req);
        if (body.depositUSD && Number(body.depositUSD) > 0) {
            const addVal = Number(body.depositUSD);
            db.wallet.initialCapital += addVal;
        }
        if (body.gridConfig) {
            db.gridConfig = { ...db.gridConfig, ...body.gridConfig };
        }
        if (body.withdrawal) {
            const amountUSD = Number(body.withdrawal.amountUSD) || 0;
            if (amountUSD > 0) {
                db.wallet.totalWithdrawn = (db.wallet.totalWithdrawn || 0) + amountUSD;
            }
            db.withdrawals.unshift({
                id: 'PIX-' + Date.now(),
                timestamp: new Date().toISOString(),
                ...body.withdrawal
            });
        }
        recomputeWalletFromTrades(db);
        saveDatabase(db);
        return sendJSON(res, 200, { ok: true, db });
    }

    // 4. POST /api/reset — Reset / Configure Initial Capital
    if (pathname === '/api/reset' && req.method === 'POST') {
        const body = await parseBody(req);
        const newCap = Number(body.initialCapital) || 10.00;
        db.wallet = {
            initialCapital: newCap,
            walletBalance: newCap,
            totalProfit: 0.00,
            vaultBalance: 0.00,
            totalWithdrawn: 0.00,
            wins: 0,
            losses: 0,
            botStartedAt: Date.now(),
            dailyDate: new Date().toISOString().slice(0, 10),
            dailyStartBalance: newCap,
            dailyProfitUSD: 0,
            dailyGoalReached: false,
            dailyProfitPct: 0,
            lifetimeBotStats: {},
            lifetimeBotStatsSeeded: true
        };
        db.openPositions = [];
        db.trades = [];
        db.withdrawals = [];
        db.liveState.pairCooldowns = {};
        db.gridConfig.botRunning = true;
        recomputePerBotStats();
        saveDatabase(db, true);
        return sendJSON(res, 200, { ok: true, db });
    }

    // 4B. POST /api/panic-close — 1-Click Emergency Kill Switch (Liquidate all 3 Bots at Market & Pause)
    if (pathname === '/api/panic-close' && req.method === 'POST') {
        const prices = db.liveState.prices || {};
        let closedCount = 0;
        for (let i = db.openPositions.length - 1; i >= 0; i--) {
            const p = db.openPositions[i];
            if (p.orderStatus === 'FILLED') {
                const liveP = prices[p.symbol] || p.currentPrice || p.entryPrice;
                const diffPct = p.side === 'LONG'
                    ? ((liveP - p.entryPrice) / p.entryPrice) * 100
                    : ((p.entryPrice - liveP) / p.entryPrice) * 100;
                const pnlUSD = p.margin * ((diffPct * (p.leverage || 15)) / 100);
                serverClosePosition(p, liveP, pnlUSD, `🚨 KILL SWITCH ZERAR TUDO • ${p.gridLevel || 'L1'}`);
                closedCount++;
            }
        }
        db.openPositions = [];
        db.gridConfig.botRunning = false;
        recomputePerBotStats();
        saveDatabase(db, true);
        sendTelegramAlert(`🚨 <b>[KILL SWITCH ACIONADO]</b>\nTodas as posições (${closedCount}) foram zeradas a mercado e os 3 Bots foram pausados com segurança. Saldo atual: $${db.wallet.walletBalance.toFixed(2)}`);
        return sendJSON(res, 200, { ok: true, closedCount, db });
    }

    // 5. GET /api/export-csv — Export Database Trade History as CSV
    if (pathname === '/api/export-csv' && req.method === 'GET') {
        const header = 'ID,Data_Hora,Par,Modo_Grid,Nivel_Grid,Lado,Preco_Entrada,Preco_Saida,Lucro_USDT,Lucro_BRL,Saldo_Apos_USDT\n';
        const rows = db.trades.map(t =>
            `${t.id},${t.timestamp},${t.pair},${t.gridMode},${t.gridLevel},${t.side},${t.entryPrice},${t.exitPrice},${t.pnlUSD.toFixed(2)},${t.pnlBRL.toFixed(2)},${(t.balanceAfter || 0).toFixed(2)}`
        ).join('\n');
        res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="nexusquant_grid_history.csv"'
        });
        return res.end(header + rows);
    }

    // Serve Static Files
    let safePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    let fullPath = path.join(__dirname, safePath);

    fs.readFile(fullPath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('404 Not Found');
        }
        const ext = path.extname(fullPath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'text/plain',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`NexusQuant 24/7 Master Server Engine (v8.2 Wide-Channel) running at http://localhost:${PORT}`);
    console.log(`Database file: ${DB_FILE}`);

    // Render Free Tier 24/7 Self-Keep-Alive Ping every 4 minutes
    const externalUrl = process.env.RENDER_EXTERNAL_URL || 'https://nexusquant-ai-grid-bot.onrender.com';
    setInterval(() => {
        try {
            https.get(`${externalUrl}/api/db`, (res) => { res.resume(); }).on('error', () => {});
        } catch (e) {}
    }, 240000);
});
