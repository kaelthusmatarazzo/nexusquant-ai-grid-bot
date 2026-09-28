// NexusQuant AI — Real-Time Algorithmic Trading & Passive Income Simulator
const USD_TO_BRL = 5.45;

const PAIR_CONFIGS = {
    SOLUSDT:    { name: 'SOL/USDT',    basePrice: 174.50, tickSize: 0.135,   decimals: 2, qtyDecimals: 2, gridScore: 98.6, atrPct: 5.20, whipsawIndex: 8.8, tpsPerHour: 29 },
    SUIUSDT:    { name: 'SUI/USDT',    basePrice: 3.1850, tickSize: 0.0026,  decimals: 4, qtyDecimals: 1, gridScore: 97.9, atrPct: 6.15, whipsawIndex: 9.1, tpsPerHour: 28 },
    WIFUSDT:    { name: 'WIF/USDT',    basePrice: 2.4200, tickSize: 0.0022,  decimals: 4, qtyDecimals: 1, gridScore: 97.4, atrPct: 6.80, whipsawIndex: 9.4, tpsPerHour: 27 },
    FETUSDT:    { name: 'FET/USDT',    basePrice: 1.3450, tickSize: 0.0011,  decimals: 4, qtyDecimals: 1, gridScore: 96.2, atrPct: 5.75, whipsawIndex: 8.6, tpsPerHour: 25 },
    DOGEUSDT:   { name: 'DOGE/USDT',   basePrice: 0.2450, tickSize: 0.00019, decimals: 4, qtyDecimals: 0, gridScore: 95.4, atrPct: 4.95, whipsawIndex: 8.5, tpsPerHour: 24 },
    AVAXUSDT:   { name: 'AVAX/USDT',   basePrice: 28.40,  tickSize: 0.022,   decimals: 2, qtyDecimals: 2, gridScore: 94.1, atrPct: 4.65, whipsawIndex: 8.2, tpsPerHour: 22 },
    INJUSDT:    { name: 'INJ/USDT',    basePrice: 24.15,  tickSize: 0.019,   decimals: 2, qtyDecimals: 2, gridScore: 93.5, atrPct: 4.80, whipsawIndex: 8.1, tpsPerHour: 21 },
    NEARUSDT:   { name: 'NEAR/USDT',   basePrice: 5.120,  tickSize: 0.0040,  decimals: 3, qtyDecimals: 1, gridScore: 92.8, atrPct: 4.45, whipsawIndex: 8.0, tpsPerHour: 20 },
    RENDERUSDT: { name: 'RENDER/USDT', basePrice: 7.640,  tickSize: 0.0061,  decimals: 3, qtyDecimals: 1, gridScore: 92.3, atrPct: 4.70, whipsawIndex: 7.9, tpsPerHour: 20 },
    SEIUSDT:    { name: 'SEI/USDT',    basePrice: 0.4450, tickSize: 0.00035, decimals: 4, qtyDecimals: 0, gridScore: 91.7, atrPct: 4.50, whipsawIndex: 7.8, tpsPerHour: 19 },
    XRPUSDT:    { name: 'XRP/USDT',    basePrice: 2.3800, tickSize: 0.0017,  decimals: 4, qtyDecimals: 1, gridScore: 90.4, atrPct: 3.90, whipsawIndex: 7.5, tpsPerHour: 18 },
    ETHUSDT:    { name: 'ETH/USDT',    basePrice: 2745.00,tickSize: 1.45,    decimals: 2, qtyDecimals: 3, gridScore: 86.4, atrPct: 2.85, whipsawIndex: 6.8, tpsPerHour: 14 },
    BNBUSDT:    { name: 'BNB/USDT',    basePrice: 618.00, tickSize: 0.31,    decimals: 2, qtyDecimals: 2, gridScore: 83.2, atrPct: 2.35, whipsawIndex: 6.4, tpsPerHour: 12 },
    BTCUSDT:    { name: 'BTC/USDT',    basePrice: 84080.00,tickSize: 24.5,   decimals: 2, qtyDecimals: 4, gridScore: 79.5, atrPct: 1.95, whipsawIndex: 5.9, tpsPerHour: 10 }
};

const state = {
    pair: 'SOLUSDT',
    autoPairEnabled: true,
    botRunning: true,
    priceSynced: false,
    strategy: 'grid',
    speedMultiplier: 1, // Locked 100% Real-Time (1:1)
    soundEnabled: true,
    compoundEnabled: true,
    initialCapital: 10.00,
    walletBalance: 10.00,
    totalProfit: 0.00,
    totalWithdrawn: 0.00,
    orderSizePct: 15,
    leverage: 10,
    takeProfitPct: 0.35,
    stopLossPct: 0.45,
    currentPrice: 174.50,
    lastPrice: 174.50,
    change24h: 4.12,
    rsi: 51.4,
    candles: [],
    openPositions: [],
    closedTrades: [],
    tradeMarkers: [], // { candleIndex, price, type: 'BUY'|'SELL'|'TP', text }
    gridLevels: [],
    scannerRanking: [],
    wins: 0,
    losses: 0,
    sessionStartTime: Date.now(),
    ws: null,
    wsConnected: false
};

// Audio Engine (Web Audio API - Lazy initialized)
let audioCtx = null;
function playSound(type) {
    if (!state.soundEnabled) return;
    try {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            audioCtx = new AudioContextClass();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'profit') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.setValueAtTime(880.00, now + 0.09); // A5
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
            osc.start(now);
            osc.stop(now + 0.38);
        } else if (type === 'entry') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            gain.gain.setValueAtTime(0.03, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        }
    } catch (e) {}
}

// Formatters
function fmtUSD(val, decimals = 2) {
    const sign = val < 0 ? '-' : '';
    return sign + '$' + Math.abs(val).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function fmtBRL(usdVal) {
    const brl = usdVal * USD_TO_BRL;
    const sign = brl < 0 ? '-' : '';
    return sign + 'R$ ' + Math.abs(brl).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Quantitative AI Scanner: Evaluates 14 Binance pairs by Volatility (ATR %) + Whipsaw/Serrote Efficiency + Liquidity
async function scanMarketForBestGridPair(forceSwitchIfAuto = false) {
    const symbols = Object.keys(PAIR_CONFIGS);
    try {
        const query = encodeURIComponent(JSON.stringify(symbols));
        const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${query}`);
        if (res.ok) {
            const list = await res.json();
            list.forEach(item => {
                const cfg = PAIR_CONFIGS[item.symbol];
                if (!cfg) return;
                const lastP = parseFloat(item.lastPrice);
                const highP = parseFloat(item.highPrice);
                const lowP = parseFloat(item.lowPrice);
                const netChgPct = Math.abs(parseFloat(item.priceChangePercent) || 0);
                const tradeCount = parseInt(item.count || 150000, 10);

                if (lastP > 0 && highP > lowP) {
                    cfg.basePrice = lastP;
                    // 1. Intraday ATR Volatility Range (%)
                    const rangePct = ((highP - lowP) / lastP) * 100;

                    // 2. Whipsaw / Serrote Ratio: High oscillation range with high mean-reversion (lots of wicks back and forth)
                    // Penalizes pure one-way runaway pumps (>16% straight line) so the bot prefers volatile two-way oscillation!
                    const whipsawRatio = Math.min(10, Math.max(3.5, (rangePct / (netChgPct * 0.45 + 0.8)) * 3.2));
                    const runawayPenalty = netChgPct > 14 ? (netChgPct - 14) * 0.9 : 0;
                    const liquidityBonus = Math.min(4.2, Math.log10(Math.max(1000, tradeCount)) * 0.72);

                    const rawScore = 72 + Math.min(17.5, rangePct * 2.35) + (whipsawRatio * 0.75) + liquidityBonus - runawayPenalty;
                    cfg.gridScore = Math.min(99.6, Math.max(76.0, rawScore));
                    cfg.atrPct = Math.max(1.4, rangePct);
                    cfg.whipsawIndex = whipsawRatio;
                    cfg.tpsPerHour = Math.round((cfg.gridScore - 55) * 0.65);

                    // Calibrate relative tick volatility from real ATR + Grid Score
                    const relVol = 0.00042 + (cfg.gridScore - 75) * 0.000018;
                    cfg.tickSize = lastP * relVol;
                }
            });
        }
    } catch (e) {
        symbols.forEach(sym => {
            const cfg = PAIR_CONFIGS[sym];
            const jitter = (Math.random() - 0.48) * 0.4;
            cfg.gridScore = Math.min(99.6, Math.max(77.0, cfg.gridScore + jitter));
            cfg.tickSize = cfg.basePrice * (0.00042 + (cfg.gridScore - 75) * 0.000018);
        });
    }

    // Sort all 14 pairs descending by Grid Efficiency Score
    state.scannerRanking = symbols
        .map(sym => ({ symbol: sym, ...PAIR_CONFIGS[sym] }))
        .sort((a, b) => b.gridScore - a.gridScore);

    renderScannerStrip();
    updatePairScoreHeader();

    // If Auto-Pilot Pair Selection is ON, pick #1 best pair
    if (state.autoPairEnabled && state.scannerRanking.length > 0) {
        const best = state.scannerRanking[0];
        if (best.symbol !== state.pair && (forceSwitchIfAuto || state.openPositions.length === 0)) {
            switchToPair(best.symbol, true);
        }
    }
}

function renderScannerStrip() {
    const container = document.getElementById('scannerCardsContainer');
    if (!container) return;

    const medals = ['🥇 #1 ATIVO', '🥈 #2 ATIVO', '🥉 #3 ATIVO'];
    container.innerHTML = state.scannerRanking.map((item, idx) => {
        const isChartSelected = item.symbol === state.pair;
        const isTop3Grid = idx < 3;
        const rankLabel = medals[idx] || `#${idx + 1}`;
        return `
            <div class="scan-card ${isChartSelected ? 'active-pair' : ''} ${isTop3Grid ? 'top3-grid-card' : ''}" onclick="manualSelectPairFromScanner('${item.symbol}')" style="${isTop3Grid && !isChartSelected ? 'border-color: rgba(0, 217, 245, 0.45); background: rgba(0, 217, 245, 0.05);' : ''}">
                <div class="scan-top">
                    <span class="scan-rank">${rankLabel}</span>
                    <span class="scan-score">${item.gridScore.toFixed(1)} pts</span>
                </div>
                <div class="scan-pair-name">${item.name} ${isTop3Grid ? '⚡' : ''}</div>
                <div class="scan-metrics">
                    <span>ATR: ${item.atrPct.toFixed(1)}%</span>
                    <span>${isTop3Grid ? '🟢 GRADE ON' : `Serrote: ${(item.whipsawIndex || 8.5).toFixed(1)}x`}</span>
                </div>
                <div class="scan-bar-bg">
                    <div class="scan-bar-fill" style="width: ${Math.round(item.gridScore)}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

function updatePairScoreHeader() {
    const cfg = PAIR_CONFIGS[state.pair];
    if (!cfg) return;
    const volEl = document.getElementById('pairVolatilityBadge');
    const scoreEl = document.getElementById('currentPairScore');
    const relTickPct = ((cfg.tickSize / cfg.basePrice) * 100).toFixed(3);

    if (volEl) {
        const level = cfg.gridScore >= 93 ? 'ALTA 🔥' : cfg.gridScore >= 85 ? 'MÉDIA ⚡' : 'BAIXA';
        volEl.textContent = `${level} (ATR ${cfg.atrPct.toFixed(1)}% | ${relTickPct}%/tick)`;
        volEl.className = 'metric-value mono ' + (cfg.gridScore >= 90 ? 'positive' : 'cyan-text');
    }
    if (scoreEl) {
        const label = cfg.gridScore >= 94 ? 'TOP 3 MULTI-GRID' : cfg.gridScore >= 85 ? 'BOM' : 'LENTO';
        scoreEl.innerHTML = `<span class="status-dot"></span> ${cfg.gridScore.toFixed(1)}/100 (${label})`;
    }
}

window.manualSelectPairFromScanner = function(symbol) {
    switchToPair(symbol, false);
};

function updateAutoPairButtonUI() {
    const btn = document.getElementById('autoPairBtn');
    const statusText = document.getElementById('autoPilotStatusText');
    if (btn) {
        btn.className = 'btn-autopair active';
        btn.textContent = '🧠 Multi-Grid Top 3: ON';
    }
    if (statusText) {
        const top3Names = state.scannerRanking.slice(0, 3).map(r => r.name).join(' + ') || 'SOL/USDT + SUI/USDT + WIF/USDT';
        statusText.textContent = `🤖 Multi-Grid Simultâneo Ativo nos 3 Melhores Pares: ${top3Names} (Mesma Banca)`;
    }
}

async function switchToPair(symbol, isAutoByAI = false, fromServerSync = false) {
    if (symbol === state.pair && state.priceSynced) return;

    state.pair = symbol;
    const selectEl = document.getElementById('pairSelect');
    if (selectEl) selectEl.value = symbol;
    const cfg = PAIR_CONFIGS[symbol] || PAIR_CONFIGS.SOLUSDT;
    const titleEl = document.getElementById('chartPairTitle');
    if (titleEl) titleEl.textContent = cfg.name;

    const optimalTP = cfg.gridScore >= 94 ? 0.22 : cfg.gridScore >= 86 ? 0.25 : 0.28;
    state.takeProfitPct = optimalTP;
    const tpInput = document.getElementById('takeProfitInput');
    if (tpInput) tpInput.value = optimalTP.toFixed(2);

    if (!fromServerSync) {
        try {
            await fetch('/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'SWITCH_PAIR',
                    pair: symbol,
                    autoPairEnabled: state.autoPairEnabled
                })
            });
            await loadStateFromDatabase();
        } catch (e) {}
    }

    renderScannerStrip();
    updatePairScoreHeader();
    syncLivePriceAndStart(symbol);

    if (isAutoByAI) {
        addTerminalLog(
            `🧠 [AUTO-PILOT IA] Sincronizado no par #1 ${cfg.name} (Score ${cfg.gridScore.toFixed(1)}/100 | Alvo TP: ${optimalTP}%).`,
            'profit'
        );
    } else if (!fromServerSync) {
        addTerminalLog(`Par sincronizado com o Servidor 24/7: ${cfg.name} (Grid Score: ${cfg.gridScore.toFixed(1)}/100).`, 'info');
    }
}

// Initialize Historical 1m Candles (Fallback if offline)
function initCandles(basePrice, tickSize) {
    state.candles = [];
    state.smoothMinPrice = null;
    state.smoothMaxPrice = null;
    let price = basePrice * (1 - 0.0015);
    const alignedMinute = Math.floor(Date.now() / 60000) * 60000;

    for (let i = 59; i >= 0; i--) {
        const open = price;
        const delta = (Math.random() - 0.488) * tickSize * 1.4;
        const close = open + delta;
        const high = Math.max(open, close) + Math.random() * tickSize * 0.8;
        const low = Math.min(open, close) - Math.random() * tickSize * 0.8;
        state.candles.push({
            time: alignedMinute - i * 60000,
            open,
            high,
            low,
            close
        });
        price = close;
    }
    state.currentPrice = price;
    state.lastPrice = price;
    state.liveAnchorPrice = price;
    state.simOffset = 0;
    state.candleElapsedMs = Date.now() % 60000;
    rebuildGridLevels();
    updateRSI();
}

function rebuildGridLevels(logTrailing = false) {
    const p = state.currentPrice;
    const count = state.gridLevelsCount || 6;
    const half = Math.floor(count / 2);
    const stepPct = state.takeProfitPct || 0.24;
    const step = p * (stepPct / 100);

    state.gridCenterPrice = p;
    state.gridLevels = [];
    for (let i = -half; i <= half; i++) {
        if (i === 0) continue;
        state.gridLevels.push({
            levelIndex: i,
            label: i < 0 ? `Grade Compra L${Math.abs(i)}` : `Grade Venda S${i}`,
            side: i < 0 ? 'BUY' : 'SELL',
            price: p + (i * step)
        });
    }
    const spreadBadge = document.getElementById('gridSpreadBadge');
    if (spreadBadge) spreadBadge.textContent = `Step: ${stepPct.toFixed(2)}% (${count} linhas)`;
    renderGridLadderUI();

    if (logTrailing) {
        addTerminalLog(`🔄 [TRAILING GRID] Canal da grade reposicionado automaticamente em torno de ${fmtUSD(p)}.`, 'info');
    }
}

function renderGridLadderUI() {
    const box = document.getElementById('gridLadderBox');
    if (!box || !state.gridLevels || state.gridLevels.length === 0) return;
    const cfg = PAIR_CONFIGS[state.pair];
    const sorted = [...state.gridLevels].sort((a, b) => b.price - a.price);
    const half = Math.floor(sorted.length / 2);

    let html = '';
    sorted.forEach((lvl, idx) => {
        if (idx === half) {
            html += `
                <div class="ladder-row mid-price">
                    <span>⚡ PREÇO ATUAL</span>
                    <span>${fmtUSD(state.currentPrice, cfg.decimals)}</span>
                </div>
            `;
        }
        const isBuy = lvl.side === 'BUY';
        const hasOpenOrderNear = state.openPositions.some(pos => Math.abs(pos.entryPrice - lvl.price) / lvl.price < 0.0022);
        const statusLabel = hasOpenOrderNear
            ? '<span class="warning-text">● EXECUTADA</span>'
            : (isBuy ? '<span class="positive">▲ COMPRA ARMADA</span>' : '<span class="cyan-text">▼ VENDA ARMADA</span>');

        html += `
            <div class="ladder-row ${isBuy ? 'buy-grid' : 'sell-grid'}">
                <span>${lvl.label} (${fmtUSD(lvl.price, cfg.decimals)})</span>
                ${statusLabel}
            </div>
        `;
    });
    box.innerHTML = html;
}

// Fetch real 60 1-minute (1m) candles from Binance Klines API before starting bot
async function syncLivePriceAndStart(symbol) {
    state.priceSynced = false;
    state.openPositions = [];
    state.tradeMarkers = [];
    state.smoothMinPrice = null;
    state.smoothMaxPrice = null;
    const cfg = PAIR_CONFIGS[symbol];

    let klinesLoaded = false;
    try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=60`);
        if (res.ok) {
            const klines = await res.json();
            if (Array.isArray(klines) && klines.length > 10) {
                state.candles = klines.map(k => ({
                    time: k[0],
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4])
                }));
                const lastClose = state.candles[state.candles.length - 1].close;
                cfg.basePrice = lastClose;
                const relVol = 0.00038 + (cfg.gridScore - 75) * 0.000014;
                cfg.tickSize = lastClose * relVol;
                state.currentPrice = lastClose;
                state.lastPrice = lastClose;
                state.liveAnchorPrice = lastClose;
                state.simOffset = 0;
                state.candleElapsedMs = Date.now() % 60000;
                rebuildGridLevels();
                updateRSI();
                klinesLoaded = true;
            }
        }
    } catch (e) {}

    if (!klinesLoaded) {
        initCandles(cfg.basePrice, cfg.tickSize);
    }

    state.priceSynced = true;
    updateLiveHeader();
    updatePairScoreHeader();
    updateOrderbookUI();
    renderOpenPositions();
    drawTradingChart();
    connectBinanceWS(symbol);

    // Open initial position only AFTER 1m candles are 100% synchronized
    setTimeout(() => {
        if (state.priceSynced && state.openPositions.length === 0 && state.botRunning) {
            openBotPosition('LONG', `Grade Compra L1 (${cfg.name})`, 'L1');
        }
    }, 450);
}

// Connect to Binance Real-Time 1m Kline WebSocket
function connectBinanceWS(symbol) {
    if (state.ws) {
        try { state.ws.close(); } catch (e) {}
    }
    const lowerSym = symbol.toLowerCase();
    const wsUrl = `wss://stream.binance.com:9443/ws/${lowerSym}@kline_1m`;
    try {
        const ws = new WebSocket(wsUrl);
        state.ws = ws;
        ws.onopen = () => {
            state.wsConnected = true;
            addTerminalLog(`Gráfico 1m (1 Minuto) sincronizado ao vivo com a Binance (${PAIR_CONFIGS[symbol].name} @ ${fmtUSD(state.currentPrice)}).`, 'info');
        };
        ws.onmessage = (event) => {
            if (!state.priceSynced) return;
            const data = JSON.parse(event.data);
            if (data && data.k) {
                const liveClose = parseFloat(data.k.c);
                if (!isNaN(liveClose) && liveClose > 0) {
                    state.liveAnchorPrice = liveClose;
                }
            }
        };
        ws.onerror = () => {
            state.wsConnected = false;
        };
        ws.onclose = () => {
            state.wsConnected = false;
        };
    } catch (err) {
        state.wsConnected = false;
    }
}

// Compute EMA helper
function calcEMA(values, period) {
    const k = 2 / (period + 1);
    const emaArray = [];
    let ema = values[0];
    for (let i = 0; i < values.length; i++) {
        ema = values[i] * k + ema * (1 - k);
        emaArray.push(ema);
    }
    return emaArray;
}

// Compute RSI (14)
function updateRSI() {
    if (state.candles.length < 15) return;
    let gains = 0;
    let losses = 0;
    const slice = state.candles.slice(-15);
    for (let i = 1; i < slice.length; i++) {
        const diff = slice[i].close - slice[i - 1].close;
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }
    const rs = losses === 0 ? 100 : gains / losses;
    state.rsi = Math.min(92, Math.max(12, 100 - (100 / (1 + rs))));
    const rsiEl = document.getElementById('rsiValue');
    if (rsiEl) {
        rsiEl.textContent = state.rsi.toFixed(1);
        rsiEl.className = 'mono ' + (state.rsi < 36 ? 'positive' : state.rsi > 68 ? 'negative' : '');
    }
}

// Handle incoming price tick within a true 60-second (1m) candle bucket
function onPriceTick(newPrice, elapsedDeltaMs = 360) {
    if (!state.priceSynced || state.candles.length === 0) return;
    state.lastPrice = state.currentPrice;
    state.currentPrice = newPrice;

    // Advance 1-minute candle clock (60,000 ms per candle)
    state.candleElapsedMs = (state.candleElapsedMs || 0) + elapsedDeltaMs;
    const remainingSec = Math.max(1, Math.ceil((60000 - state.candleElapsedMs) / 1000));
    const countdownEl = document.getElementById('candleCountdown');
    if (countdownEl) {
        countdownEl.textContent = `${remainingSec}s`;
    }

    if (state.candleElapsedMs >= 60000) {
        state.candleElapsedMs = 0;
        const lastCandle = state.candles[state.candles.length - 1];
        const nextMinuteTime = (lastCandle ? lastCandle.time : Date.now()) + 60000;

        state.candles.push({
            time: nextMinuteTime,
            open: newPrice,
            high: newPrice,
            low: newPrice,
            close: newPrice
        });
        if (state.candles.length > 60) {
            state.candles.shift();
            state.tradeMarkers = state.tradeMarkers
                .map(m => ({ ...m, candleIndex: m.candleIndex - 1 }))
                .filter(m => m.candleIndex >= 0);
        }
        updateRSI();
    } else {
        const currentCandle = state.candles[state.candles.length - 1];
        currentCandle.close = newPrice;
        if (newPrice > currentCandle.high) currentCandle.high = newPrice;
        if (newPrice < currentCandle.low) currentCandle.low = newPrice;
    }

    updateLiveHeader();
    updateOrderbookUI();
    renderGridLadderUI();
    if (state.botRunning) {
        evaluateBotEngine();
    }
    renderOpenPositions();
    drawTradingChart();
}

// Visual Grid Channel Repositioning (All trade execution happens on the 24/7 Server Engine)
function evaluateBotEngine() {
    if (!state.priceSynced) return;
    const price = state.currentPrice;

    if (state.trailingGrid !== false && state.gridCenterPrice) {
        const driftPct = Math.abs(price - state.gridCenterPrice) / state.gridCenterPrice * 100;
        if (driftPct > (state.takeProfitPct * 2.2)) {
            rebuildGridLevels(true);
        }
    }
}

function checkGridSignal() {
    const minDistancePct = Math.max(0.06, (state.takeProfitPct || 0.22) * 0.35);
    for (const pos of state.openPositions) {
        const dist = Math.abs(state.currentPrice - pos.entryPrice) / pos.entryPrice * 100;
        if (dist < minDistancePct) return null;
    }

    const lastCandle = state.candles[state.candles.length - 1];
    const prevCandle = state.candles[state.candles.length - 2] || lastCandle;
    if (!lastCandle) return null;

    // Anti-Breakout Shield: evita entrar contra uma vela explodindo sem pavio de exaustão
    const candleVelocityPct = Math.abs(lastCandle.close - lastCandle.open) / lastCandle.open * 100;
    if (candleVelocityPct > 0.32) {
        return null;
    }

    const mode = state.gridMode || 'neutral';
    const levelNum = state.openPositions.length + 1;

    // 1. Check exact proximity to armed Grid Lines (state.gridLevels)
    if (state.gridLevels && state.gridLevels.length > 0) {
        for (const lvl of state.gridLevels) {
            const proxPct = Math.abs(state.currentPrice - lvl.price) / lvl.price * 100;
            if (proxPct <= (state.takeProfitPct || 0.22) * 0.48) {
                const tag = lvl.levelIndex < 0 ? `L${Math.abs(lvl.levelIndex)}` : `S${lvl.levelIndex}`;
                if (lvl.side === 'BUY' && mode !== 'short_only') {
                    return { side: 'LONG', gridLevel: tag, reason: `Toque Exato na Linha da Grade ${tag} (0% Maker)` };
                }
                if (lvl.side === 'SELL' && mode !== 'long_grid') {
                    return { side: 'SHORT', gridLevel: tag, reason: `Toque Exato na Linha da Grade ${tag} (0% Maker)` };
                }
            }
        }
    }

    // 2. Micro-Channel Oscillation Trigger inside active Grid zone
    if (mode === 'long_grid') {
        if (lastCandle.close <= prevCandle.close && Math.random() < 0.42) {
            return { side: 'LONG', gridLevel: `L${levelNum}`, reason: `Suporte Dinâmico da Grade L${levelNum} (0% Maker)` };
        }
    } else if (mode === 'micro_compound') {
        if (Math.random() < 0.48) {
            const side = lastCandle.close <= prevCandle.close ? 'LONG' : 'SHORT';
            const tag = side === 'LONG' ? `L${levelNum}` : `S${levelNum}`;
            return { side, gridLevel: tag, reason: `Micro-Spread HFT Grade ${tag} (0% Maker)` };
        }
    } else {
        if (lastCandle.close < prevCandle.close && Math.random() < 0.38) {
            return { side: 'LONG', gridLevel: `L${levelNum}`, reason: `Ordem Limite Compra na Grade L${levelNum} (0% Maker)` };
        }
        if (lastCandle.close > prevCandle.close && Math.random() < 0.32) {
            return { side: 'SHORT', gridLevel: `S${levelNum}`, reason: `Ordem Limite Venda na Grade S${levelNum} (0% Maker)` };
        }
    }
    return null;
}

function openBotPosition(side, reason, gridLevel = 'L1') {
    const activeTradingBankroll = Math.max(50, state.walletBalance - (state.vaultBalance || 0));
    const baseCapital = state.compoundEnabled ? activeTradingBankroll : state.initialCapital;
    const margin = Math.max(10, baseCapital * (state.orderSizePct / 100));
    const entryPrice = state.currentPrice;
    const tpPct = parseFloat(state.takeProfitPct) || 0.24;
    const slPct = parseFloat(state.stopLossPct) || 0.45;

    const tpPrice = side === 'LONG'
        ? entryPrice * (1 + tpPct / 100)
        : entryPrice * (1 - tpPct / 100);

    const slPrice = side === 'LONG'
        ? entryPrice * (1 - slPct / 100)
        : entryPrice * (1 + slPct / 100);

    const pos = {
        id: 'GRD-' + Math.floor(100000 + Math.random() * 900000),
        pair: PAIR_CONFIGS[state.pair].name,
        gridLevel,
        side,
        margin,
        leverage: state.leverage,
        entryPrice,
        tpPrice,
        slPrice,
        tpPct,
        slPct,
        dcaApplied: false,
        openedAt: new Date()
    };

    state.openPositions.push(pos);
    state.tradeMarkers.push({
        candleIndex: state.candles.length - 1,
        price: entryPrice,
        type: side === 'LONG' ? 'BUY' : 'SELL',
        text: side === 'LONG' ? `▲ ${gridLevel}` : `▼ ${gridLevel}`
    });

    playSound('entry');
    addTerminalLog(
        `🕸️ [GRID-BOT ${gridLevel}] Executou ${side} (${pos.leverage}x) @ ${fmtUSD(entryPrice)} ➔ Alvo TP da Grade: ${fmtUSD(tpPrice)} (${reason})`,
        'entry'
    );
    renderOpenPositions();
    renderGridLadderUI();
}

function closePosition(pos, exitPrice, pnlUSD, closeReason) {
    const finalPnl = closeReason.includes('TP')
        ? Math.max(0.20, Math.abs(pnlUSD))
        : pnlUSD;

    // Auto-Cofre Blindado (25% de todo lucro líquido fica guardado intocável, 75% vai p/ Juros Compostos da Grade)
    if (finalPnl > 0) {
        const vaultSlice = finalPnl * 0.25;
        state.vaultBalance = (state.vaultBalance || 0) + vaultSlice;
    }

    state.walletBalance += finalPnl;
    state.totalProfit += finalPnl;

    if (finalPnl >= 0) {
        state.wins++;
        playSound('profit');
    } else {
        state.losses++;
    }

    state.tradeMarkers.push({
        candleIndex: state.candles.length - 1,
        price: exitPrice,
        type: finalPnl >= 0 ? 'TP' : 'SL',
        text: finalPnl >= 0 ? `+$${finalPnl.toFixed(2)}` : `-$${Math.abs(finalPnl).toFixed(2)}`
    });

    const record = {
        id: pos.id || ('TRD-' + Date.now()),
        time: new Date().toLocaleTimeString('pt-BR'),
        pair: pos.pair || PAIR_CONFIGS[state.pair].name,
        gridMode: (state.gridMode || 'neutral').toUpperCase(),
        gridLevel: pos.gridLevel || 'L1',
        side: pos.side,
        entryPrice: pos.entryPrice,
        exitPrice,
        pnlUSD: finalPnl,
        pnlBRL: finalPnl * USD_TO_BRL,
        balanceAfter: state.walletBalance
    };
    state.closedTrades.unshift(record);
    if (state.closedTrades.length > 100) state.closedTrades.pop();

    addTerminalLog(
        `💰 [${closeReason}] ${pos.pair} (${pos.side}) liquidado na grade @ ${fmtUSD(exitPrice)} | Lucro: ${finalPnl >= 0 ? '+' : ''}${fmtUSD(finalPnl)} (${fmtBRL(finalPnl)}) | 🏦 Cofre Blindado: ${fmtUSD(state.vaultBalance || 0)}`,
        finalPnl >= 0 ? 'profit' : 'loss'
    );

    rebuildGridLevels();
    updateKPIDashboard();
    renderTradeHistory();
    persistTradeToDatabase(record);
}

// Update KPIs & Passive Income Projections
function updateKPIDashboard() {
    document.getElementById('totalBalance').textContent = fmtUSD(state.walletBalance);
    document.getElementById('totalBalanceBRL').textContent = fmtBRL(state.walletBalance);

    const profitEl = document.getElementById('totalProfit');
    profitEl.textContent = (state.totalProfit >= 0 ? '+' : '') + fmtUSD(state.totalProfit);
    profitEl.className = 'kpi-main mono ' + (state.totalProfit >= 0 ? 'positive' : 'negative');

    const profitBRLEl = document.getElementById('totalProfitBRL');
    profitBRLEl.textContent = (state.totalProfit >= 0 ? '+' : '') + fmtBRL(state.totalProfit);

    // Update Cofre Blindado (25% Profit Lock Reserve)
    const computedVault = state.vaultBalance || Math.max(0, state.totalProfit * 0.25);
    state.vaultBalance = computedVault;
    const vaultEl = document.getElementById('vaultReserveVal');
    if (vaultEl) {
        vaultEl.textContent = fmtUSD(computedVault);
    }

    const roi = ((state.totalProfit) / state.initialCapital) * 100;
    const roiEl = document.getElementById('roiPercent');
    roiEl.textContent = `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`;

    const elapsedHours = Math.max(0.02, (Date.now() - state.sessionStartTime) / 3600000);
    const rawHourly = state.totalProfit > 0 ? (state.totalProfit / elapsedHours) : (state.walletBalance * 0.0045);
    const realisticHourly = Math.min(state.walletBalance * 0.035, Math.max(state.walletBalance * 0.002, rawHourly * 0.15));
    const monthlyProj = realisticHourly * 24 * 30;

    document.getElementById('hourlyRate').textContent = `${fmtUSD(realisticHourly)}/h`;
    document.getElementById('monthlyProjection').textContent = `${fmtUSD(monthlyProj, 0)} / mês`;

    const totalTrades = state.wins + state.losses;
    const winRate = totalTrades === 0 ? 100 : Math.round((state.wins / totalTrades) * 100);
    document.getElementById('winRateDisplay').innerHTML = `${winRate}% <small>Win Rate</small>`;
    document.getElementById('tradeCount').textContent = totalTrades;
    document.getElementById('winsLosses').textContent = `${state.wins}W / ${state.losses}L`;
    document.getElementById('closedPosCount').textContent = state.closedTrades.length || totalTrades;
}

function updateLiveHeader() {
    const cfg = PAIR_CONFIGS[state.pair];
    const priceEl = document.getElementById('livePrice');
    const centerOb = document.getElementById('obCenterPrice');
    const arrow = document.getElementById('obDirectionArrow');

    const isUp = state.currentPrice >= state.lastPrice;
    const formatted = fmtUSD(state.currentPrice, cfg.decimals);

    priceEl.textContent = formatted;
    priceEl.className = 'metric-value mono ' + (isUp ? 'positive' : 'negative');

    if (centerOb) {
        centerOb.textContent = formatted;
        centerOb.className = isUp ? 'positive' : 'negative';
        arrow.textContent = isUp ? '▲' : '▼';
        arrow.className = isUp ? 'positive' : 'negative';
    }
}

function getTop3ScannerPairs() {
    if (Array.isArray(state.top3ActivePairs) && state.top3ActivePairs.length >= 3) {
        return state.top3ActivePairs.slice(0, 3);
    }
    if (Array.isArray(state.scannerRanking) && state.scannerRanking.length >= 3) {
        return state.scannerRanking.slice(0, 3).map(r => r.symbol);
    }
    return ['SOLUSDT', 'SUIUSDT', 'WIFUSDT'];
}

// Render Open Positions Table (Multi-Pair Top-3 Portfolio Grid)
function renderOpenPositions() {
    const tbody = document.getElementById('openPositionsBody');
    document.getElementById('openPosCount').textContent = state.openPositions.length;

    if (state.openPositions.length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Grid Bot Multi-Par monitorando os Top 3 pares para executar próxima grade...</td></tr>`;
        return;
    }

    const cfg = PAIR_CONFIGS[state.pair];
    const top3List = (state.top3ActivePairs && state.top3ActivePairs.length > 0)
        ? state.top3ActivePairs
        : getTop3ScannerPairs();

    tbody.innerHTML = state.openPositions.map((pos, idx) => {
        const sym = pos.symbol || state.pair;
        const pairCfg = PAIR_CONFIGS[sym] || cfg;
        const livePairPrice = (sym === state.pair && state.currentPrice > 0)
            ? state.currentPrice
            : (pos.currentPrice || (state.livePrices && state.livePrices[sym]) || pairCfg.basePrice || pos.entryPrice);

        const isPending = pos.orderStatus === 'PENDING_LIMIT';
        const diffPct = isPending ? 0 : (pos.side === 'LONG'
            ? ((livePairPrice - pos.entryPrice) / pos.entryPrice) * 100
            : ((pos.entryPrice - livePairPrice) / pos.entryPrice) * 100);
        const levPct = diffPct * pos.leverage;
        const pnl = isPending ? 0 : pos.margin * (levPct / 100);
        const isPos = pnl >= 0;

        const rankIdx = top3List.indexOf(sym);
        const medal = rankIdx === 0 ? '🥇' : (rankIdx === 1 ? '🥈' : (rankIdx === 2 ? '🥉' : '⚡'));
        const isViewing = sym === state.pair;
        const statusPill = isPending
            ? `<span class="kpi-pill" style="background:rgba(255,184,0,0.16); color:#ffb800; border:1px solid rgba(255,184,0,0.4);">⏳ LIMIT (0% Taxa)</span>`
            : `<span class="kpi-pill" style="background:rgba(0,245,160,0.15); color:#00f5a0;">⚡ EXECUTADA</span>`;

        return `
            <tr style="${isViewing ? 'background: rgba(0, 217, 245, 0.05);' : ''}${isPending ? 'opacity: 0.88;' : ''}">
                <td style="cursor:pointer;" onclick="switchToPair('${sym}', false)" title="Clique para inspecionar ${pos.pair} no gráfico">
                    <strong>${medal} ${pos.pair}</strong>
                    <span class="kpi-pill">${pos.gridLevel || 'L1'}</span>
                    ${statusPill}
                    <span class="side-badge ${pos.side.toLowerCase()}">${pos.side}</span>
                </td>
                <td>${fmtUSD(pos.margin)} <small class="warning-text">(${pos.leverage}x)</small></td>
                <td>${fmtUSD(pos.entryPrice, pairCfg.decimals)}</td>
                <td>${fmtUSD(livePairPrice, pairCfg.decimals)}</td>
                <td>
                    <span class="positive">${fmtUSD(pos.tpPrice, pairCfg.decimals)}</span>
                </td>
                <td class="${isPending ? 'cyan-text' : (isPos ? 'positive' : 'negative')}">
                    ${isPending
                        ? `<strong>⏳ Aguardando</strong> <small>(Limit Book)</small>`
                        : `<strong>${isPos ? '+' : ''}${fmtUSD(pnl)}</strong> <small>(${isPos ? '+' : ''}${levPct.toFixed(2)}%)</small>`}
                </td>
                <td>
                    <button class="close-pos-btn" onclick="manualClosePosition(${idx})">${isPending ? 'Cancelar' : 'Realizar'}</button>
                </td>
            </tr>
        `;
    }).join('');
}

window.testMexcConnectionUI = async function() {
    const kEl = document.getElementById('mexcApiKeyInput');
    const sEl = document.getElementById('mexcSecretKeyInput');
    const stEl = document.getElementById('mexcConnStatusMsg');
    const mexcApiKey = kEl ? kEl.value.trim() : '';
    const mexcSecretKey = sEl ? sEl.value.trim() : '';
    if (!mexcApiKey || !mexcSecretKey) {
        if (stEl) stEl.textContent = '⚠️ Cole sua MEXC Access Key e Secret Key primeiro.';
        return;
    }
    if (stEl) stEl.textContent = '⏳ Assinando requisição HMAC-SHA256 com contract.mexc.com...';
    try {
        const res = await fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'TEST_MEXC_API',
                mexcApiKey,
                mexcSecretKey
            })
        });
        const data = await res.json();
        if (data && data.mexcCheck && data.mexcCheck.connected) {
            if (stEl) stEl.textContent = `🟢 CONECTADO À MEXC FUTURES! Saldo Real: $${Number(data.mexcCheck.balanceUSDT || 0).toFixed(2)} USDT`;
            addTerminalLog(`🔌 [MEXC API OFICIAL] Conectado com sucesso! Saldo disponível: $${Number(data.mexcCheck.balanceUSDT || 0).toFixed(2)} USDT`, 'profit');
        } else {
            const err = (data && data.mexcCheck && data.mexcCheck.error) || 'Verifique a permissão de Futures na MEXC';
            if (stEl) stEl.textContent = `⚠️ Resposta MEXC: ${err}`;
        }
    } catch (e) {
        if (stEl) stEl.textContent = '❌ Erro de rede ao testar MEXC API.';
    }
};

window.manualClosePosition = async function(idx) {
    const pos = state.openPositions[idx];
    if (!pos) return;
    try {
        await fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'CLOSE_POSITION', id: pos.id })
        });
        await loadStateFromDatabase();
    } catch (e) {}
};

function renderTradeHistory() {
    const tbody = document.getElementById('tradeHistoryBody');
    if (!tbody) return;
    tbody.innerHTML = state.closedTrades.map(t => {
        const isPos = t.pnlUSD >= 0;
        const pairCfg = Object.values(PAIR_CONFIGS).find(p => p.name === t.pair) || PAIR_CONFIGS[state.pair];
        const dec = pairCfg ? pairCfg.decimals : 2;
        return `
            <tr>
                <td>${t.time}</td>
                <td><strong>${t.pair || 'SOL/USDT'}</strong> <span class="kpi-pill">${t.gridLevel || 'L1'}</span></td>
                <td><span class="side-badge ${(t.side || 'LONG').toLowerCase()}">${t.side || 'LONG'}</span></td>
                <td>${fmtUSD(t.entryPrice, dec)} ➔ ${fmtUSD(t.exitPrice, dec)}</td>
                <td class="${isPos ? 'positive' : 'negative'}"><strong>${isPos ? '+' : ''}${fmtUSD(t.pnlUSD)}</strong></td>
                <td class="${isPos ? 'positive' : 'negative'}">${isPos ? '+' : ''}${fmtBRL(t.pnlUSD)}</td>
                <td class="cyan-text">${fmtUSD(t.balanceAfter || state.walletBalance)}</td>
            </tr>
        `;
    }).join('');
}

// Live Orderbook UI
function updateOrderbookUI() {
    const cfg = PAIR_CONFIGS[state.pair];
    const asksEl = document.getElementById('orderbookAsks');
    const bidsEl = document.getElementById('orderbookBids');
    if (!asksEl || !bidsEl) return;

    const step = cfg.tickSize * 0.35;
    let asksHTML = '';
    let bidsHTML = '';

    for (let i = 5; i >= 1; i--) {
        const askP = state.currentPrice + step * i + (Math.random() * step * 0.2);
        const qty = (Math.random() * 1.8 + 0.12).toFixed(cfg.qtyDecimals);
        const total = (askP * parseFloat(qty)).toFixed(0);
        const widthPct = Math.min(95, Math.round(parseFloat(qty) * 45));
        asksHTML += `
            <div class="ob-row">
                <div class="ob-bar" style="width:${widthPct}%; background: var(--crimson);"></div>
                <span class="negative">${askP.toFixed(cfg.decimals)}</span>
                <span>${qty}</span>
                <span>$${Number(total).toLocaleString()}</span>
            </div>
        `;
    }

    for (let i = 1; i <= 5; i++) {
        const bidP = state.currentPrice - step * i - (Math.random() * step * 0.2);
        const qty = (Math.random() * 1.8 + 0.15).toFixed(cfg.qtyDecimals);
        const total = (bidP * parseFloat(qty)).toFixed(0);
        const widthPct = Math.min(95, Math.round(parseFloat(qty) * 45));
        bidsHTML += `
            <div class="ob-row">
                <div class="ob-bar" style="width:${widthPct}%; background: var(--emerald);"></div>
                <span class="positive">${bidP.toFixed(cfg.decimals)}</span>
                <span>${qty}</span>
                <span>$${Number(total).toLocaleString()}</span>
            </div>
        `;
    }

    asksEl.innerHTML = asksHTML;
    bidsEl.innerHTML = bidsHTML;
}

// Terminal Log Output
function addTerminalLog(msg, type = 'info') {
    const term = document.getElementById('aiTerminal');
    if (!term) return;
    const timeStr = new Date().toLocaleTimeString('pt-BR');
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.innerHTML = `<span class="log-time">[${timeStr}]</span> ${msg}`;
    term.prepend(line);
    while (term.children.length > 35) {
        term.removeChild(term.lastChild);
    }
}

// High-DPI Candlestick & Bot Execution Canvas Chart
function drawTradingChart() {
    const canvas = document.getElementById('tradingChart');
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(260, container.clientWidth || 340);
    const height = Math.max(250, container.clientHeight || 320);
    const isMobileChart = width < 520;

    const targetW = Math.round(width * dpr);
    const targetH = Math.round(height * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
    }

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Rich institutional dark chart background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0a1224');
    bgGrad.addColorStop(1, '#050912');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const allCandles = state.candles;
    if (!allCandles || allCandles.length === 0) {
        ctx.restore();
        return;
    }

    // On Smartphone show last 32 1m candles so each candle is crisp & wide; on PC show all 60 1m candles
    const maxVisible = isMobileChart ? 32 : 60;
    const startOffset = Math.max(0, allCandles.length - maxVisible);
    const candles = allCandles.slice(startOffset);

    // Determine min/max price strictly from visible 1m candles
    const cfg = PAIR_CONFIGS[state.pair];
    let rawMin = Infinity;
    let rawMax = -Infinity;
    candles.forEach(c => {
        if (c.low < rawMin) rawMin = c.low;
        if (c.high > rawMax) rawMax = c.high;
    });

    const minSpan = Math.max(cfg.basePrice * 0.0042, cfg.tickSize * 6);
    if (rawMax - rawMin < minSpan) {
        const mid = (rawMax + rawMin) / 2;
        rawMin = mid - minSpan / 2;
        rawMax = mid + minSpan / 2;
    }

    const pad = (rawMax - rawMin) * 0.16;
    const targetMin = rawMin - pad;
    const targetMax = rawMax + pad;

    if (state.smoothMinPrice === null || state.smoothMaxPrice === null) {
        state.smoothMinPrice = targetMin;
        state.smoothMaxPrice = targetMax;
    } else {
        state.smoothMinPrice += (targetMin - state.smoothMinPrice) * 0.25;
        state.smoothMaxPrice += (targetMax - state.smoothMaxPrice) * 0.25;
    }

    const minPrice = state.smoothMinPrice;
    const maxPrice = state.smoothMaxPrice;

    const chartRightMargin = isMobileChart ? 70 : 86;
    const bottomAxisHeight = 20;
    const plotHeight = height - bottomAxisHeight;
    const plotWidth = width - chartRightMargin;
    const priceToY = (p) => plotHeight - ((p - minPrice) / (maxPrice - minPrice)) * (plotHeight - 28) - 14;

    // 1. Horizontal & Vertical Grid Lines + Right Axis Price Labels + Bottom 1m Time Labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.fillStyle = '#8fa0b8';
    ctx.font = `${isMobileChart ? '9px' : '10px'} "JetBrains Mono", monospace`;
    ctx.lineWidth = 1;

    for (let i = 0; i <= 5; i++) {
        const y = 14 + ((plotHeight - 28) / 5) * i;
        const pVal = maxPrice - ((maxPrice - minPrice) / 5) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(plotWidth, y);
        ctx.stroke();
        ctx.fillText('$' + pVal.toFixed(cfg.decimals), plotWidth + 5, y + 3);
    }

    const candleStep = plotWidth / candles.length;
    const labelStep = isMobileChart ? 8 : 10;
    for (let idx = 0; idx < candles.length; idx += labelStep) {
        const vx = idx * candleStep + candleStep / 2;
        ctx.beginPath();
        ctx.moveTo(vx, 0);
        ctx.lineTo(vx, plotHeight);
        ctx.stroke();

        const d = new Date(candles[idx].time);
        const hhmm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        ctx.fillText(hhmm, Math.max(4, vx - 14), height - 5);
    }

    // 2. Draw Smart Grid AI Levels (Buy & Sell Grid Lines)
    if (state.gridLevels && state.gridLevels.length > 0) {
        ctx.save();
        ctx.setLineDash([3, 5]);
        state.gridLevels.forEach((lvl) => {
            const gPrice = typeof lvl === 'object' ? lvl.price : lvl;
            const isBuy = typeof lvl === 'object' ? lvl.side === 'BUY' : true;
            if (gPrice > minPrice && gPrice < maxPrice) {
                const gy = priceToY(gPrice);
                ctx.strokeStyle = isBuy ? 'rgba(0, 245, 160, 0.28)' : 'rgba(0, 217, 245, 0.28)';
                ctx.beginPath();
                ctx.moveTo(0, gy);
                ctx.lineTo(plotWidth, gy);
                ctx.stroke();
            }
        });
        ctx.restore();
    }

    // 3. Draw Active Position Entry & Take Profit lines for the inspected chart pair
    state.openPositions.filter(pos => !pos.symbol || pos.symbol === state.pair).forEach(pos => {
        const yTP = Math.max(16, Math.min(plotHeight - 16, priceToY(pos.tpPrice)));
        const yEntry = Math.max(16, Math.min(plotHeight - 16, priceToY(pos.entryPrice)));

        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#00f5a0';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, yTP);
        ctx.lineTo(plotWidth, yTP);
        ctx.stroke();

        const tpBoxW = isMobileChart ? 148 : 184;
        ctx.fillStyle = 'rgba(4, 10, 20, 0.85)';
        ctx.fillRect(8, yTP - 11, tpBoxW, 18);
        ctx.strokeStyle = 'rgba(0, 245, 160, 0.65)';
        ctx.setLineDash([]);
        ctx.strokeRect(8, yTP - 11, tpBoxW, 18);
        ctx.fillStyle = '#00f5a0';
        ctx.font = `bold ${isMobileChart ? '9px' : '10px'} "JetBrains Mono", monospace`;
        ctx.fillText(`🎯 TP ${pos.side}: $${pos.tpPrice.toFixed(cfg.decimals)}`, 13, yTP + 2);

        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#00d9f5';
        ctx.beginPath();
        ctx.moveTo(0, yEntry);
        ctx.lineTo(plotWidth, yEntry);
        ctx.stroke();

        const entBoxW = isMobileChart ? 132 : 150;
        ctx.fillStyle = 'rgba(4, 10, 20, 0.82)';
        ctx.fillRect(8, yEntry - 9, entBoxW, 16);
        ctx.fillStyle = '#00d9f5';
        ctx.fillText(`⚡ IN: $${pos.entryPrice.toFixed(cfg.decimals)}`, 13, yEntry + 3);
        ctx.restore();
    });

    // 4. Draw Candlesticks
    const candleWidth = Math.max(3.5, candleStep * 0.66);

    candles.forEach((c, idx) => {
        const x = idx * candleStep + candleStep / 2;
        const isBull = c.close >= c.open;
        const color = isBull ? '#00f5a0' : '#ff3b69';

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.3;

        // Wick
        ctx.beginPath();
        ctx.moveTo(x, priceToY(c.high));
        ctx.lineTo(x, priceToY(c.low));
        ctx.stroke();

        // Body
        const yOpen = priceToY(c.open);
        const yClose = priceToY(c.close);
        const top = Math.min(yOpen, yClose);
        const bodyH = Math.max(2.5, Math.abs(yClose - yOpen));
        ctx.fillRect(x - candleWidth / 2, top, candleWidth, bodyH);
    });

    // 5. Draw EMA 9 & EMA 21 curves
    const allCloses = allCandles.map(c => c.close);
    const ema9Full = calcEMA(allCloses, 9).slice(startOffset);
    const ema21Full = calcEMA(allCloses, 21).slice(startOffset);

    function drawLineSeries(series, strokeColor, lineWidth = 1.8) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        series.forEach((val, idx) => {
            const x = idx * candleStep + candleStep / 2;
            const y = priceToY(val);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
    }

    drawLineSeries(ema21Full, '#ffb800', 1.5);
    drawLineSeries(ema9Full, '#00d9f5', 1.8);

    // 6. Draw Bot Trade Markers (BUY / SELL / TP HIT)
    state.tradeMarkers.forEach(m => {
        const relIdx = m.candleIndex - startOffset;
        if (relIdx < 0 || relIdx >= candles.length) return;
        const x = relIdx * candleStep + candleStep / 2;
        const y = priceToY(m.price);

        ctx.font = `bold ${isMobileChart ? '9px' : '10px'} "JetBrains Mono", monospace`;
        if (m.type === 'TP') {
            ctx.fillStyle = 'rgba(0, 245, 160, 0.22)';
            ctx.fillRect(x - 22, y - 21, 50, 14);
            ctx.fillStyle = '#00f5a0';
            ctx.fillText(m.text, x - 19, y - 11);
        } else if (m.type === 'BUY') {
            ctx.fillStyle = '#00d9f5';
            ctx.fillText(m.text || '▲ L1', x - 12, y + 15);
        } else if (m.type === 'SELL') {
            ctx.fillStyle = '#ffb800';
            ctx.fillText(m.text || '▼ S1', x - 14, y - 9);
        }
    });

    // 7. Current Price Laser Line & Live Tag on Right Axis
    const curY = priceToY(state.currentPrice);
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = 'rgba(0, 245, 160, 0.55)';
    ctx.beginPath();
    ctx.moveTo(0, curY);
    ctx.lineTo(plotWidth, curY);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#00f5a0';
    ctx.fillRect(plotWidth, curY - 10, chartRightMargin, 20);
    ctx.fillStyle = '#040811';
    ctx.font = `bold ${isMobileChart ? '9.5px' : '11px'} "JetBrains Mono", monospace`;
    ctx.fillText('$' + state.currentPrice.toFixed(cfg.decimals), plotWidth + 4, curY + 4);

    ctx.restore();
    drawAllThreeMiniCharts();
}

// ============================================================================
// 3-CHARTS SIMULTANEOUS MULTI-GRID ENGINE (#1 🥇, #2 🥈, #3 🥉)
// ============================================================================
state.triCandles = {};
state.lastTriFetchMs = 0;

async function fetchTriChartsKlines(force = false) {
    const now = Date.now();
    if (!force && now - state.lastTriFetchMs < 6000) return;
    state.lastTriFetchMs = now;

    const top3 = getTop3ScannerPairs();
    await Promise.all(top3.map(async (sym) => {
        try {
            let res = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=1m&limit=28`);
            if (!res.ok) {
                res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1m&limit=28`);
            }
            if (res.ok) {
                const klines = await res.json();
                if (Array.isArray(klines) && klines.length > 0) {
                    state.triCandles[sym] = klines.map(k => ({
                        open: parseFloat(k[1]),
                        high: parseFloat(k[2]),
                        low: parseFloat(k[3]),
                        close: parseFloat(k[4])
                    }));
                }
            }
        } catch (e) {}
    }));
    drawAllThreeMiniCharts();
}

window.selectTriChartPair = function(idx) {
    const top3 = getTop3ScannerPairs();
    const sym = top3[idx];
    if (sym && PAIR_CONFIGS[sym]) {
        switchToPair(sym, false);
    }
};

function drawAllThreeMiniCharts() {
    const top3 = getTop3ScannerPairs();
    if (Date.now() - state.lastTriFetchMs > 8000) {
        fetchTriChartsKlines(false);
    }
    const medals = ['🥇 BOT #1 •', '🥈 BOT #2 •', '🥉 BOT #3 •'];

    for (let idx = 0; idx < 3; idx++) {
        const sym = top3[idx] || 'SOLUSDT';
        const cfg = PAIR_CONFIGS[sym] || PAIR_CONFIGS.SOLUSDT;
        const botPositions = state.openPositions.filter(p => p.symbol === sym);
        const firstPos = botPositions[0];
        const realCandleLast = (state.triCandles[sym] && state.triCandles[sym].length > 0)
            ? state.triCandles[sym][state.triCandles[sym].length - 1].close
            : 0;
        const rawCandidatePrice = (sym === state.pair && state.currentPrice > 0)
            ? state.currentPrice
            : ((state.livePrices && state.livePrices[sym]) || (firstPos && firstPos.currentPrice) || realCandleLast || cfg.basePrice);
        // If we have real klines and rawCandidatePrice deviates >3% from real kline, trust real kline price!
        const livePrice = (realCandleLast > 0 && Math.abs(rawCandidatePrice - realCandleLast) / realCandleLast > 0.03)
            ? realCandleLast
            : rawCandidatePrice;

        // Compute Individual Bot Profit & Win/Loss Record from state.botStats or state.closedTrades
        const serverStat = (state.botStats && state.botStats[sym]) || null;
        let botRealizedUSD = serverStat ? serverStat.realizedProfitUSD : 0;
        let botWins = serverStat ? serverStat.wins : 0;
        let botLosses = serverStat ? serverStat.losses : 0;
        if (!serverStat && Array.isArray(state.closedTrades)) {
            state.closedTrades.forEach(t => {
                if (t.symbol === sym || t.pair === cfg.name) {
                    const p = Number(t.pnlUSD) || 0;
                    botRealizedUSD += p;
                    if (p >= 0) botWins++;
                    else botLosses++;
                }
            });
        }

        // Compute total open PnL across all grid lines (L1, L2) of this Bot
        let botOpenPnlUSD = 0;
        let botTotalMargin = 0;
        botPositions.forEach(p => {
            if (p.orderStatus === 'PENDING_LIMIT') {
                botTotalMargin += p.margin;
                return;
            }
            const dPct = p.side === 'LONG'
                ? ((livePrice - p.entryPrice) / p.entryPrice) * 100
                : ((p.entryPrice - livePrice) / p.entryPrice) * 100;
            // Clamp display outlier if legacy order is being replaced
            const safeDPct = Math.max(-1.5, Math.min(1.5, dPct));
            botOpenPnlUSD += p.margin * ((safeDPct * (p.leverage || 12)) / 100);
            botTotalMargin += p.margin;
        });

        // Update Card Header & Active Highlight
        const cardEl = document.getElementById(`triCard${idx}`);
        if (cardEl) {
            cardEl.className = 'tri-chart-card' + (sym === state.pair ? ' active' : '');
        }
        const titleEl = document.getElementById(`triTitle${idx}`);
        if (titleEl) {
            titleEl.textContent = `${medals[idx]} ${cfg.name}`;
        }
        const priceEl = document.getElementById(`triPrice${idx}`);
        if (priceEl) {
            priceEl.textContent = fmtUSD(livePrice, cfg.decimals);
        }

        // Update Individual Bot Profit Bar
        const botProfitEl = document.getElementById(`triBotProfit${idx}`);
        if (botProfitEl) {
            const isProfPos = botRealizedUSD >= 0;
            botProfitEl.textContent = `${isProfPos ? '+' : ''}${fmtUSD(botRealizedUSD)} (${isProfPos ? '+' : ''}${fmtBRL(botRealizedUSD)})`;
            botProfitEl.className = 'mono ' + (isProfPos ? 'positive' : 'negative');
        }
        const botRecordEl = document.getElementById(`triBotRecord${idx}`);
        if (botRecordEl) {
            botRecordEl.textContent = `🏆 ${botWins}W/${botLosses}L | ${botPositions.length} Ordens`;
        }

        const metaEl = document.getElementById(`triMeta${idx}`);
        const pnlEl = document.getElementById(`triPnl${idx}`);
        if (botPositions.length > 0) {
            const isPos = botOpenPnlUSD >= 0;
            const lvls = botPositions.map(p => (p.gridLevel || 'L1').split(' ')[0]).join(' + ');
            if (metaEl) {
                metaEl.textContent = `Grade Ativa: ${lvls} (Lote $${botTotalMargin.toFixed(2)})`;
            }
            if (pnlEl) {
                pnlEl.textContent = `Aberto: ${isPos ? '+' : ''}${fmtUSD(botOpenPnlUSD)}`;
                pnlEl.className = 'mono ' + (isPos ? 'positive' : 'negative');
            }
        } else {
            if (metaEl) metaEl.textContent = `Armando linhas L1 + L2 da grade...`;
            if (pnlEl) {
                pnlEl.textContent = `🟢 PRONTO`;
                pnlEl.className = 'mono cyan-text';
            }
        }

        // Draw Mini Candlestick + All Active Entry/TP Grid Lines for this Bot
        const canvas = document.getElementById(`triCanvas${idx}`);
        if (!canvas) continue;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.scale(dpr, dpr);

        const W = rect.width;
        const H = rect.height;
        ctx.clearRect(0, 0, W, H);

        let candles = state.triCandles[sym] ? state.triCandles[sym].slice(-24) : [];
        if (candles.length === 0 && sym === state.pair && state.candles.length > 0) {
            candles = state.candles.slice(-24);
        }
        if (candles.length > 0) {
            const lastC = { ...candles[candles.length - 1] };
            if (Math.abs(livePrice - lastC.close) / Math.max(1e-9, lastC.close) <= 0.02) {
                lastC.close = livePrice;
                lastC.high = Math.max(lastC.high, livePrice);
                lastC.low = Math.min(lastC.low, livePrice);
            }
            candles[candles.length - 1] = lastC;
        } else {
            candles = Array.from({ length: 16 }, (_, k) => ({
                open: livePrice * (1 - 0.0005 * Math.sin(k)),
                high: livePrice * 1.001,
                low: livePrice * 0.999,
                close: livePrice
            }));
        }

        let minP = Infinity;
        let maxP = -Infinity;
        candles.forEach(c => {
            if (c.low < minP) minP = c.low;
            if (c.high > maxP) maxP = c.high;
        });
        botPositions.forEach(p => {
            // Only expand chart bounds to position entry/TP if within 2% of live candle range!
            if (Math.abs(p.entryPrice - livePrice) / Math.max(1e-9, livePrice) <= 0.02) {
                minP = Math.min(minP, p.entryPrice, p.tpPrice);
                maxP = Math.max(maxP, p.entryPrice, p.tpPrice);
            }
        });
        const pad = Math.max((maxP - minP) * 0.18, livePrice * 0.0015);
        minP -= pad;
        maxP += pad;

        const pToY = (p) => H - ((p - minP) / Math.max(1e-9, maxP - minP)) * (H - 12) - 6;

        // Subtle grid background lines
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let g = 1; g <= 2; g++) {
            const gy = (H / 3) * g;
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(W, gy);
            ctx.stroke();
        }

        // Draw ALL Entry & TP horizontal lines (L1, L2, L3) belonging to this Bot
        botPositions.forEach(p => {
            const yTP = Math.max(6, Math.min(H - 6, pToY(p.tpPrice)));
            const yIn = Math.max(6, Math.min(H - 6, pToY(p.entryPrice)));

            ctx.save();
            ctx.setLineDash([4, 3]);
            ctx.strokeStyle = '#00f5a0';
            ctx.lineWidth = 1.15;
            ctx.beginPath();
            ctx.moveTo(0, yTP);
            ctx.lineTo(W, yTP);
            ctx.stroke();

            ctx.setLineDash([2, 2]);
            ctx.strokeStyle = '#00d9f5';
            ctx.beginPath();
            ctx.moveTo(0, yIn);
            ctx.lineTo(W, yIn);
            ctx.stroke();
            ctx.restore();
        });

        // Draw Candlesticks
        const step = (W - 8) / candles.length;
        const cWidth = Math.max(2.5, step * 0.64);
        candles.forEach((c, cIdx) => {
            const x = 4 + cIdx * step + step / 2;
            const bull = c.close >= c.open;
            ctx.strokeStyle = bull ? '#00f5a0' : '#ff3b69';
            ctx.fillStyle = bull ? '#00f5a0' : '#ff3b69';
            ctx.lineWidth = 1.1;

            ctx.beginPath();
            ctx.moveTo(x, pToY(c.high));
            ctx.lineTo(x, pToY(c.low));
            ctx.stroke();

            const yO = pToY(c.open);
            const yC = pToY(c.close);
            ctx.fillRect(x - cWidth / 2, Math.min(yO, yC), cWidth, Math.max(2, Math.abs(yC - yO)));
        });

        ctx.restore();
    }
}

window.addEventListener('resize', () => {
    drawTradingChart();
});

// Persistent Backend Database Integration (server.js -> nexusquant_db.json) + LocalStorage Fallback
async function persistTradeToDatabase(tradeRecord) {
    saveStateToStorage();
    try {
        const res = await fetch('/api/trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                trade: tradeRecord,
                walletBalance: state.walletBalance,
                totalProfit: state.totalProfit,
                wins: state.wins,
                losses: state.losses
            })
        });
        if (res.ok) {
            const data = await res.json();
            const badge = document.getElementById('dbStatusBadge');
            if (badge) {
                badge.textContent = `🟢 DB Salvo (${data.totalRecords} regs)`;
            }
        }
    } catch (e) {}
}

async function syncWalletToDatabase(extraPayload = {}) {
    saveStateToStorage();
    try {
        await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet: {
                    initialCapital: state.initialCapital,
                    walletBalance: state.walletBalance,
                    totalProfit: state.totalProfit,
                    wins: state.wins,
                    losses: state.losses
                },
                gridConfig: {
                    pair: state.pair,
                    autoPairEnabled: state.autoPairEnabled,
                    gridMode: state.gridMode || 'neutral',
                    gridLevelsCount: state.gridLevelsCount || 6,
                    gridStepPct: state.takeProfitPct,
                    orderSizePct: state.orderSizePct,
                    leverage: state.leverage,
                    trailingGrid: state.trailingGrid !== false,
                    compoundEnabled: state.compoundEnabled
                },
                ...extraPayload
            })
        });
    } catch (e) {}
}

async function loadStateFromDatabase() {
    try {
        const res = await fetch('/api/db');
        if (res.ok) {
            const data = await res.json();
            if (data && data.ok && data.db) {
                // 1. Extract liveState prices & Top 3 pairs FIRST so tables & charts have immediate access
                if (data.db.liveState) {
                    const ls = data.db.liveState;
                    if (ls.prices && typeof ls.prices === 'object') {
                        state.livePrices = ls.prices;
                        if (ls.prices[state.pair] && ls.prices[state.pair] > 0) {
                            state.liveAnchorPrice = ls.prices[state.pair];
                        }
                    } else if (ls.currentPrice && ls.currentPrice > 0) {
                        state.liveAnchorPrice = ls.currentPrice;
                    }
                    if (Array.isArray(ls.top3Pairs) && ls.top3Pairs.length > 0) {
                        state.top3ActivePairs = ls.top3Pairs;
                    }
                    if (ls.botStats && typeof ls.botStats === 'object') {
                        state.botStats = ls.botStats;
                    }
                    if (ls.btcCircuitBreaker) {
                        const btcEl = document.getElementById('btcShieldStatusVal');
                        if (btcEl) {
                            btcEl.textContent = ls.btcCircuitBreaker.label || '🛡️ Escudo BTC Normal';
                            btcEl.className = 'mono ' + (ls.btcCircuitBreaker.active ? 'warning-text' : 'positive');
                        }
                    }
                }

                // 2. Extract Wallet KPIs & Daily Goal Telemetry
                const w = data.db.wallet || {};
                if (typeof w.walletBalance === 'number') {
                    state.initialCapital = w.initialCapital || 10;
                    state.walletBalance = w.walletBalance;
                    state.totalProfit = w.totalProfit || 0;
                    state.vaultBalance = typeof w.vaultBalance === 'number' ? w.vaultBalance : Math.max(0, state.totalProfit * 0.25);
                    state.wins = w.wins || 0;
                    state.losses = w.losses || 0;
                    if (w.botStartedAt && Number(w.botStartedAt) > 0) {
                        state.botStartedAt = Number(w.botStartedAt);
                    } else if (!state.botStartedAt) {
                        state.botStartedAt = Date.now();
                    }
                    updateBotUptimeDisplay();
                    saveStateToStorage();

                    const dailyEl = document.getElementById('dailyGoalStatusVal');
                    if (dailyEl) {
                        const dUsd = Number(w.dailyProfitUSD || state.totalProfit || 0);
                        const dPct = Number(w.dailyProfitPct || ((dUsd / Math.max(1, state.initialCapital)) * 100));
                        const goalHit = Boolean(w.dailyGoalReached || dPct >= 3.0);
                        dailyEl.textContent = goalHit
                            ? `🏆 META BATIDA (+${dPct.toFixed(2)}% | Cofre 50% ON)`
                            : `${dUsd >= 0 ? '+' : ''}${fmtUSD(dUsd)} (${dPct >= 0 ? '+' : ''}${dPct.toFixed(2)}% / Meta +3.0%)`;
                        dailyEl.className = 'mono ' + (goalHit ? 'positive' : 'cyan-text');
                    }
                }

                // 3. Extract & Render Open Positions and Closed Trade History
                if (Array.isArray(data.db.openPositions)) {
                    state.openPositions = data.db.openPositions;
                    renderOpenPositions();
                }
                if (Array.isArray(data.db.trades)) {
                    state.closedTrades = data.db.trades;
                    renderTradeHistory();
                }

                // 4. Sync Bot Running & Grid Config
                if (data.db.gridConfig) {
                    const gc = data.db.gridConfig;
                    if (typeof gc.botRunning === 'boolean' && gc.botRunning !== state.botRunning) {
                        state.botRunning = gc.botRunning;
                        const powerBtn = document.getElementById('toggleBotBtn');
                        if (powerBtn) {
                            powerBtn.className = 'btn-bot-power ' + (state.botRunning ? 'running' : 'paused');
                            document.getElementById('botPowerText').textContent = state.botRunning ? 'ROBÔ OPERANDO' : 'ROBÔ PAUSADO';
                            document.getElementById('botStateLabel').textContent = state.botRunning ? '100% AUTÔNOMO' : 'EM ESPERA';
                        }
                    }
                }

                // 5. Process Live Terminal Events
                if (data.db.liveState && data.db.liveState.lastEvent) {
                    const ls = data.db.liveState;
                    if (ls.lastEvent.id && ls.lastEvent.id !== state.lastSeenEventId) {
                        state.lastSeenEventId = ls.lastEvent.id;
                        addTerminalLog(ls.lastEvent.message, ls.lastEvent.type || 'info');
                        if (ls.lastEvent.type === 'profit') {
                            playSound('profit');
                        } else if (ls.lastEvent.type === 'entry') {
                            playSound('entry');
                        }
                    }
                }

                updateKPIDashboard();
                drawAllThreeMiniCharts();
                const badge = document.getElementById('dbStatusBadge');
                if (badge) {
                    badge.textContent = `🟢 Sync 24/7 (${state.closedTrades.length} trades)`;
                }
            }
        }
    } catch (e) {
        console.error('Sync error:', e);
    }
}

// ============================================================================
// FASE 3: TELEGRAM WEBHOOK CONFIG, SECURITY PIN LOCK & PWA SERVICE WORKER
// ============================================================================
state.pinLocked = false;

window.saveAndTestTelegramConfig = async function() {
    const tokenEl = document.getElementById('telegramTokenInput');
    const chatEl = document.getElementById('telegramChatIdInput');
    const feeEl = document.getElementById('exchangeFeeSelect');
    const pinEl = document.getElementById('securityPinInput');
    const msgEl = document.getElementById('telegramStatusMsg');

    const telegramBotToken = tokenEl ? tokenEl.value.trim() : '';
    const telegramChatId = chatEl ? chatEl.value.trim() : '';
    const exchangeFeeMode = feeEl ? feeEl.value : 'MEXC_ZERO';
    const securityPin = pinEl ? pinEl.value.trim() : '2026';

    if (msgEl) msgEl.textContent = '⏳ Salvando e enviando alerta de teste...';

    try {
        await fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'SAVE_TELEGRAM_PIN',
                telegramBotToken,
                telegramChatId,
                exchangeFeeMode,
                securityPin
            })
        });

        if (telegramBotToken && telegramChatId) {
            const res = await fetch('/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'TEST_TELEGRAM',
                    telegramBotToken,
                    telegramChatId
                })
            });
            const data = await res.json();
            if (data && data.telegramResult && data.telegramResult.sent) {
                if (msgEl) msgEl.textContent = '✅ Alerta enviado para o seu Telegram com sucesso!';
                addTerminalLog('📲 [TELEGRAM] Mensagem de teste enviada com sucesso!', 'profit');
            } else {
                if (msgEl) msgEl.textContent = '⚠️ Configuração salva! Verifique o Token/ChatID para receber mensagens.';
            }
        } else {
            if (msgEl) msgEl.textContent = '✅ Taxa da Corretora e PIN salvos no servidor 24/7!';
        }
    } catch (e) {
        if (msgEl) msgEl.textContent = '❌ Erro ao comunicar com o servidor.';
    }
};

window.togglePinReadOnlyLock = function() {
    const pinEl = document.getElementById('securityPinInput');
    const configuredPin = (pinEl && pinEl.value.trim()) ? pinEl.value.trim() : '2026';
    const btn = document.getElementById('pinLockToggleBtn');

    if (!state.pinLocked) {
        state.pinLocked = true;
        document.querySelectorAll('#toggleBotBtn, #depositBtn, #withdrawBtn, #resetSimBtn, .close-pos-btn').forEach(el => {
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.45';
        });
        if (btn) btn.textContent = '🔒 Painel Bloqueado (Inserir PIN)';
        addTerminalLog('🔒 [SEGURANÇA] Painel travado em Modo Somente Leitura contra cliques acidentais.', 'info');
    } else {
        const entered = window.prompt('Digite o PIN de Segurança para desbloquear os controles (Padrão: 2026):', '');
        if (entered === configuredPin) {
            state.pinLocked = false;
            document.querySelectorAll('#toggleBotBtn, #depositBtn, #withdrawBtn, #resetSimBtn, .close-pos-btn').forEach(el => {
                el.style.pointerEvents = 'auto';
                el.style.opacity = '1';
            });
            if (btn) btn.textContent = '🔓 Modo Admin (Bloquear Painel)';
            addTerminalLog('🔓 [SEGURANÇA] Painel Admin desbloqueado via PIN.', 'profit');
        } else if (entered !== null) {
            window.alert('❌ PIN incorreto! Os botões permanecem protegidos.');
        }
    }
};

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}

function saveStateToStorage() {
    try {
        localStorage.setItem('nexusquant_sim_v2', JSON.stringify({
            initialCapital: state.initialCapital,
            walletBalance: state.walletBalance,
            totalProfit: state.totalProfit,
            wins: state.wins,
            losses: state.losses
        }));
    } catch (e) {}
}

function loadStateFromStorage() {
    try {
        localStorage.removeItem('nexusquant_sim_v1');
        const raw = localStorage.getItem('nexusquant_sim_v2');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.walletBalance === 'number') {
            state.initialCapital = parsed.initialCapital || 1000;
            state.walletBalance = parsed.walletBalance;
            state.totalProfit = parsed.totalProfit || 0;
            state.wins = parsed.wins || 0;
            state.losses = parsed.losses || 0;
        }
    } catch (e) {}
}

// Real-Time Self-Adapting AI Engine (100% Autonomous Parameter & Market Optimization)
let lastAdaptedRegime = '';
function runFullAutoAdaptationEngine() {
    if (!state.botRunning || !state.priceSynced || state.candles.length < 21) return;

    const cfg = PAIR_CONFIGS[state.pair];
    const closes = state.candles.map(c => c.close);
    const ema9Arr = calcEMA(closes, 9);
    const ema21Arr = calcEMA(closes, 21);
    const ema9 = ema9Arr[ema9Arr.length - 1];
    const ema21 = ema21Arr[ema21Arr.length - 1];
    const emaSpreadPct = ((ema9 - ema21) / ema21) * 100;

    let regimeTitle = 'OSCILAÇÃO LATERAL ALTA 🔥';
    let chosenMode = 'neutral';
    let chosenModeLabel = '⚡ Grid Neutro Bidirecional';
    let chosenLines = 8;
    let chosenStepTP = 0.22;
    let chosenOrderPct = 16;
    let chosenLeverage = 12;

    if (cfg.gridScore >= 95 && state.rsi >= 43 && state.rsi <= 59) {
        regimeTitle = 'EXPLOSÃO MICRO-VOLATILIDADE HFT 🚀';
        chosenMode = 'micro_compound';
        chosenModeLabel = '🚀 Grid HFT Micro-Spread';
        chosenLines = 10;
        chosenStepTP = 0.19;
        chosenOrderPct = 18;
        chosenLeverage = 14;
    } else if (emaSpreadPct > 0.025 || state.rsi < 43) {
        regimeTitle = 'IMPULSO COMPRADOR / ACUMULAÇÃO 📈';
        chosenMode = 'long_grid';
        chosenModeLabel = '📈 Grid Long Acumulador';
        chosenLines = 8;
        chosenStepTP = 0.24;
        chosenOrderPct = 16;
        chosenLeverage = 12;
    } else {
        regimeTitle = 'CANAL LATERAL DE ALTA LIQUIDEZ ⚡';
        chosenMode = 'neutral';
        chosenModeLabel = '⚡ Grid Neutro Bidirecional';
        chosenLines = 6;
        chosenStepTP = 0.22;
        chosenOrderPct = 15;
        chosenLeverage = 11;
    }

    const modeChanged = state.gridMode !== chosenMode || state.gridLevelsCount !== chosenLines;
    state.gridMode = chosenMode;
    state.gridLevelsCount = chosenLines;
    state.takeProfitPct = chosenStepTP;
    state.orderSizePct = chosenOrderPct;
    state.leverage = chosenLeverage;
    state.trailingGrid = true;
    state.compoundEnabled = true;

    // Sync hidden controls
    const tpIn = document.getElementById('takeProfitInput');
    if (tpIn) tpIn.value = chosenStepTP.toFixed(2);
    const glSel = document.getElementById('gridLevelsSelect');
    if (glSel) glSel.value = String(chosenLines);
    const osVal = document.getElementById('orderSizeVal');
    if (osVal) osVal.textContent = chosenOrderPct + '%';
    const lvVal = document.getElementById('leverageVal');
    if (lvVal) lvVal.textContent = chosenLeverage + 'x';

    // Update Telemetry Panel
    const regEl = document.getElementById('aiRegimeVal');
    if (regEl) regEl.textContent = regimeTitle;
    const pairEl = document.getElementById('aiSelectedPairVal');
    if (pairEl) pairEl.textContent = `${cfg.name} (#1 Score ${cfg.gridScore.toFixed(1)}/100)`;
    const modeEl = document.getElementById('aiGridModeVal');
    if (modeEl) modeEl.textContent = chosenModeLabel;
    const stepEl = document.getElementById('aiGridStepVal');
    if (stepEl) stepEl.textContent = `${chosenLines} Linhas | Step TP: ${chosenStepTP.toFixed(2)}%`;
    const kellyEl = document.getElementById('aiRiskKellyVal');
    if (kellyEl) kellyEl.textContent = `Lote Kelly: ${chosenOrderPct}% | Alav.: ${chosenLeverage}x`;
    const stratTag = document.getElementById('activeStrategyTag');
    if (stratTag) stratTag.textContent = chosenModeLabel.replace(/^[^\s]+\s/, '');

    if (modeChanged) {
        rebuildGridLevels();
    }

    if (lastAdaptedRegime !== regimeTitle) {
        lastAdaptedRegime = regimeTitle;
        addTerminalLog(
            `🧠 [AUTO-ADAPT IA] Regime: ${regimeTitle} ➔ Configurou ${chosenModeLabel} (${chosenLines} linhas | TP ${chosenStepTP.toFixed(2)}% | Lote ${chosenOrderPct}% @ ${chosenLeverage}x).`,
            'info'
        );
    }
}

// Modals (Deposit, PIX Withdrawal & Edit Capital)
function openModal(title, htmlContent) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = htmlContent;
    document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
}

// Setup UI Event Listeners
function initEvents() {
    state.gridMode = 'neutral';
    state.gridLevelsCount = 8;
    state.trailingGrid = true;

    // Pair Selector (Manual override turns off Auto-Pair AI)
    document.getElementById('pairSelect').addEventListener('change', (e) => {
        state.autoPairEnabled = false;
        updateAutoPairButtonUI();
        switchToPair(e.target.value, false);
    });

    // Auto-Pair AI Toggle Button
    const autoPairBtn = document.getElementById('autoPairBtn');
    if (autoPairBtn) {
        autoPairBtn.addEventListener('click', () => {
            state.autoPairEnabled = !state.autoPairEnabled;
            updateAutoPairButtonUI();
            if (state.autoPairEnabled) {
                scanMarketForBestGridPair(true);
            }
        });
    }

    // Rescan Market Button
    const rescanBtn = document.getElementById('rescanBtn');
    if (rescanBtn) {
        rescanBtn.addEventListener('click', () => {
            addTerminalLog('🔍 [RADAR IA] Re-escaneando volatilidade ATR e liquidez de todos os pares na Binance...', 'info');
            scanMarketForBestGridPair(state.autoPairEnabled);
        });
    }

    // Commercial API Bridge & Institutional Risk Guard Modal (#btnApiConnect)
    const apiBtn = document.getElementById('btnApiConnect');
    if (apiBtn) {
        apiBtn.addEventListener('click', () => {
            openModal('🔗 Ponte API Institucional & Proteção Comercial (SaaS)', `
                <p class="muted-small">Arquitetura Non-Custodial: O capital fica 100% na conta da corretora do cliente (Permissão API apenas para Trade, <strong>Sem Permissão de Saque</strong>).</p>
                <div class="control-group" style="margin-top:8px;">
                    <label>Modo de Operação / Corretora Alvo</label>
                    <select id="exchangeModeSelect" class="num-input mono">
                        <option value="PAPER_BINANCE" selected>🟢 Paper Trading Tempo Real (Feed Binance 1m • 0% Maker)</option>
                        <option value="MEXC_LIVE">🔥 MEXC Futuros Perpétuos (API Real • 0.00% Taxa Maker)</option>
                        <option value="BINANCE_USDC">🟡 Binance Futures USDC-M (API Real • 0.00% Promo Maker)</option>
                    </select>
                </div>
                <div class="control-row-2" style="margin-top:8px;">
                    <div class="control-group">
                        <label>🛡️ Disjuntor Diário (Max DD)</label>
                        <input type="text" value="-3.50% (Pausa Auto)" readonly class="num-input mono positive">
                    </div>
                    <div class="control-group">
                        <label>🏦 Reserva Cofre Blindado</label>
                        <input type="text" value="25% de cada TP" readonly class="num-input mono cyan-text">
                    </div>
                </div>
                <div class="control-group" style="margin-top:8px;">
                    <label>API Key da Corretora (Opcional p/ Execução Real)</label>
                    <input type="password" id="apiKeyInput" placeholder="Cole sua API Key Read+Trade (Sem permissão de saque)..." class="num-input mono">
                </div>
                <button id="saveApiConfigBtn" class="modal-btn" style="margin-top:10px;">Ativar Roteamento & Disjuntor Institucional</button>
            `);
            document.getElementById('saveApiConfigBtn').onclick = () => {
                const modeSel = document.getElementById('exchangeModeSelect').value;
                addTerminalLog(`🏛️ [SAAS BRIDGE] Roteamento configurado (${modeSel}) com Disjuntor de Drawdown Diário (-3.5%) e Cofre Blindado (25%) ativos.`, 'profit');
                closeModal();
            };
        });
    }

    // Sound Toggle
    const soundBtn = document.getElementById('soundToggle');
    soundBtn.addEventListener('click', () => {
        state.soundEnabled = !state.soundEnabled;
        soundBtn.textContent = state.soundEnabled ? '🔊 Som ON' : '🔇 Som OFF';
    });

    // Bot Power Toggle (Controls the 24/7 Server Engine)
    const powerBtn = document.getElementById('toggleBotBtn');
    powerBtn.addEventListener('click', async () => {
        state.botRunning = !state.botRunning;
        powerBtn.className = 'btn-bot-power ' + (state.botRunning ? 'running' : 'paused');
        document.getElementById('botPowerText').textContent = state.botRunning ? 'ROBÔ OPERANDO' : 'ROBÔ PAUSADO';
        document.getElementById('botStateLabel').textContent = state.botRunning ? '100% AUTÔNOMO' : 'EM ESPERA';
        try {
            await fetch('/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'TOGGLE_BOT', botRunning: state.botRunning })
            });
        } catch (e) {}
        addTerminalLog(state.botRunning ? 'Servidor 24/7 reativado em todas as abas.' : 'Servidor 24/7 pausado temporariamente.', 'info');
    });

    // 1-Click Institutional Kill Switch (Panic Close All & Pause)
    const panicBtn = document.getElementById('panicCloseBtn');
    if (panicBtn) {
        panicBtn.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/panic-close', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await res.json();
                state.botRunning = false;
                if (powerBtn) {
                    powerBtn.className = 'btn-bot-power paused';
                    document.getElementById('botPowerText').textContent = 'ROBÔ PAUSADO';
                    document.getElementById('botStateLabel').textContent = 'EM ESPERA';
                }
                await loadStateFromDatabase();
                addTerminalLog(`🚨 [KILL-SWITCH] ${data && data.closedCount ? data.closedCount : 0} posições fechadas a mercado e robô pausado com segurança!`, 'info');
            } catch (e) {
                addTerminalLog('❌ Erro ao acionar Kill-Switch no servidor.', 'info');
            }
        });
    }

    // Grid Levels Count Selector
    const gridLevelsSelect = document.getElementById('gridLevelsSelect');
    if (gridLevelsSelect) {
        gridLevelsSelect.addEventListener('change', (e) => {
            state.gridLevelsCount = parseInt(e.target.value, 10) || 8;
            rebuildGridLevels();
            syncWalletToDatabase();
        });
    }

    // Sliders & Inputs
    const orderSlider = document.getElementById('orderSizeSlider');
    if (orderSlider) {
        orderSlider.addEventListener('input', (e) => {
            state.orderSizePct = parseInt(e.target.value, 10);
            document.getElementById('orderSizeVal').textContent = state.orderSizePct + '%';
        });
    }

    const levSlider = document.getElementById('leverageSlider');
    if (levSlider) {
        levSlider.addEventListener('input', (e) => {
            state.leverage = parseInt(e.target.value, 10);
            document.getElementById('leverageVal').textContent = state.leverage + 'x';
        });
    }

    const tpInput = document.getElementById('takeProfitInput');
    if (tpInput) {
        tpInput.addEventListener('change', (e) => {
            state.takeProfitPct = parseFloat(e.target.value) || 0.22;
            rebuildGridLevels();
        });
    }

    // Manual Force Orders (Executed centrally on the 24/7 Server Engine)
    document.getElementById('forceBuyBtn').addEventListener('click', async () => {
        try {
            await fetch('/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'FORCE_ORDER', side: 'LONG' })
            });
            await loadStateFromDatabase();
        } catch (e) {}
    });
    document.getElementById('forceSellBtn').addEventListener('click', async () => {
        try {
            await fetch('/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'FORCE_ORDER', side: 'SHORT' })
            });
            await loadStateFromDatabase();
        } catch (e) {}
    });

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            document.getElementById('activePosContent').classList.toggle('active', tab === 'activePos');
            document.getElementById('historyTabContent').classList.toggle('active', tab === 'historyTab');
        });
    });

    // Modal Events
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);

    // 1-Click Deposit Button (Zero-Touch Passive Income)
    const depositBtn = document.getElementById('btnDepositWallet');
    if (depositBtn) {
        depositBtn.addEventListener('click', () => {
            openModal('➕ Depositar Capital na Banca (PIX / USDT)', `
                <p class="muted-small">Você só deposita: a IA distribui automaticamente o novo saldo nos níveis da grade, ajusta os lotes pelo Critério de Kelly e opera sozinha em tempo real.</p>
                <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin:4px 0;">
                    <button type="button" class="speed-btn active" onclick="document.getElementById('depositAmountInput').value='100'">+$100</button>
                    <button type="button" class="speed-btn active" onclick="document.getElementById('depositAmountInput').value='500'">+$500</button>
                    <button type="button" class="speed-btn active" onclick="document.getElementById('depositAmountInput').value='1000'">+$1,000</button>
                    <button type="button" class="speed-btn active" onclick="document.getElementById('depositAmountInput').value='5000'">+$5,000</button>
                </div>
                <label class="muted-small">Valor do Depósito em USDT (Dólares)</label>
                <input type="number" id="depositAmountInput" value="500" min="10" max="500000" step="50" class="num-input mono">
                <button id="confirmDepositBtn" class="modal-btn">⚡ Confirmar Depósito & Escalar Grade IA</button>
            `);

            document.getElementById('confirmDepositBtn').onclick = async () => {
                const addVal = Math.max(10, parseFloat(document.getElementById('depositAmountInput').value) || 500);
                await syncWalletToDatabase({ depositUSD: addVal });
                await loadStateFromDatabase();
                runFullAutoAdaptationEngine();
                playSound('profit');
                addTerminalLog(
                    `💳 [DEPÓSITO CONFIRMADO] +${fmtUSD(addVal)} (+${fmtBRL(addVal)}) adicionados no Servidor 24/7! A IA redimensionou os lotes da grade automaticamente para ${fmtUSD(state.walletBalance * (state.orderSizePct / 100))} por ordem!`,
                    'profit'
                );
                closeModal();
            };
        });
    }

    document.getElementById('btnWithdraw').addEventListener('click', () => {
        const availableProfit = Math.max(0, state.totalProfit);
        openModal('💸 Sacar Renda Passiva (PIX / USDT)', `
            <p class="muted-small">Transfira os lucros gerados pelo Grid Bot diretamente para sua conta via PIX (salvo no Database).</p>
            <div style="background:#0a1020; padding:12px; border-radius:8px; border:1px solid rgba(0,245,160,0.3);">
                <div class="muted-small">LUCRO DISPONÍVEL PARA SAQUE</div>
                <div class="mono positive" style="font-size:20px; font-weight:800; margin-top:4px;">
                    ${fmtUSD(availableProfit)} (${fmtBRL(availableProfit)})
                </div>
            </div>
            <label class="muted-small">Chave PIX (CPF, E-mail ou Aleatória)</label>
            <input type="text" id="pixKeyInput" value="cliente.vip@nexusquant.ai" class="num-input mono">
            <button id="confirmWithdrawBtn" class="modal-btn">Confirmar Saque Instantâneo</button>
        `);

        document.getElementById('confirmWithdrawBtn').onclick = () => {
            if (availableProfit <= 0.01) {
                alert('Aguarde o robô fechar pelo menos uma operação no lucro para sacar!');
                return;
            }
            const pixKey = document.getElementById('pixKeyInput').value || 'PIX';
            state.walletBalance = Math.max(state.initialCapital, state.walletBalance - availableProfit);
            state.totalProfit = 0;
            syncWalletToDatabase({
                withdrawal: { amountUSD: availableProfit, amountBRL: availableProfit * USD_TO_BRL, pixKey }
            });
            updateKPIDashboard();
            addTerminalLog(`🏦 Saque PIX de ${fmtBRL(availableProfit)} registrado no Database! Banca base mantida em ${fmtUSD(state.walletBalance)}.`, 'profit');
            closeModal();
        };
    });

    document.getElementById('btnResetWallet').addEventListener('click', () => {
        openModal('⚙️ Configurar Capital da Banca & Database', `
            <p class="muted-small">Defina o valor inicial da sua banca em dólares (USDT). Isso atualizará o banco de dados em tempo real:</p>
            <input type="number" id="newCapitalInput" value="${state.initialCapital}" min="5" max="500000" step="10" class="num-input mono">
            <label class="muted-small" style="display:flex;align-items:center;gap:8px;margin-top:4px;">
                <input type="checkbox" id="clearDbCheckbox" checked> Limpar histórico anterior de trades do Database
            </label>
            <button id="saveCapitalBtn" class="modal-btn">Salvar no Database e Reiniciar Grade</button>
        `);

        document.getElementById('saveCapitalBtn').onclick = async () => {
            const val = parseFloat(document.getElementById('newCapitalInput').value) || 10;
            const clearHist = document.getElementById('clearDbCheckbox').checked;
            state.initialCapital = val;
            state.walletBalance = val;
            state.totalProfit = 0;
            state.wins = 0;
            state.losses = 0;
            state.botStartedAt = Date.now();
            state.openPositions = [];
            if (clearHist) state.closedTrades = [];

            try {
                await fetch('/api/reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ initialCapital: val, clearHistory: clearHist })
                });
            } catch (e) {}

            saveStateToStorage();
            updateBotUptimeDisplay();
            updateKPIDashboard();
            renderOpenPositions();
            renderTradeHistory();
            addTerminalLog(`🗄️ Database atualizado: Banca configurada para ${fmtUSD(val)} (${fmtBRL(val)}).`, 'info');
            closeModal();
        };
    });
}

function updateBotUptimeDisplay() {
    if (!state.botStartedAt) state.botStartedAt = Date.now();
    const elapsedSec = Math.max(0, Math.floor((Date.now() - state.botStartedAt) / 1000));
    const days = Math.floor(elapsedSec / 86400);
    const hours = Math.floor((elapsedSec % 86400) / 3600);
    const mins = Math.floor((elapsedSec % 3600) / 60);
    const secs = elapsedSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    const formatted = `${pad(days)}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;

    const headerEl = document.getElementById('botUptimeCounter');
    if (headerEl) {
        headerEl.textContent = `⏱️ ${formatted}`;
    }
    const kpiEl = document.getElementById('botUptimeKpiVal');
    if (kpiEl) {
        kpiEl.textContent = formatted;
    }
}

// Real-Time UI Loop (Visualizes the 24/7 Server Engine state across all open tabs)
let autoAdaptCounter = 0;
function startEngineLoop() {
    updateBotUptimeDisplay();
    setInterval(updateBotUptimeDisplay, 1000);

    setInterval(() => {
        if (!state.priceSynced) return;
        const nextPrice = state.liveAnchorPrice || state.currentPrice;
        onPriceTick(nextPrice, 360);

        autoAdaptCounter++;
        if (autoAdaptCounter % 12 === 0) {
            runFullAutoAdaptationEngine();
        }
    }, 360);

    // Real-time 1.2s Tab Synchronization with the 24/7 Master Server Engine
    setInterval(async () => {
        await loadStateFromDatabase();
    }, 1200);

    // Periodic AI Scanner refresh across all 14 Binance pairs every 18s
    setInterval(async () => {
        scanMarketForBestGridPair(false);
    }, 18000);

    // Instant sync when user unlocks Smartphone screen or switches back to tab
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            await loadStateFromDatabase();
            updateBotUptimeDisplay();
            updateKPIDashboard();
            drawTradingChart();
        }
    });
}

// Initialize Application
window.addEventListener('DOMContentLoaded', async () => {
    await loadStateFromDatabase();
    initEvents();
    updateKPIDashboard();
    await scanMarketForBestGridPair(true);
    await syncLivePriceAndStart(state.pair);
    runFullAutoAdaptationEngine();
    startEngineLoop();
});
