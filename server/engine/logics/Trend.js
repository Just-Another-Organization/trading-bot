'use strict'

const candlesManager = require('../logics/CandlesManager')
const symbolLogic = require('../logics/SymbolLogic')
const Config = require('../Config.json').TREND_CONFIG
const LONG_TERM = 'LONG_TERM'
const MID_TERM = 'MID_TERM'
const SHORT_TERM = 'SHORT_TERM'
const LONG_TERM_CONFIG = Config.LONG_TERM_CONFIG
const MID_TERM_CONFIG = Config.MID_TERM_CONFIG
const SHORT_TERM_CONFIG = Config.SHORT_TERM_CONFIG
const SINGLE_MA_PERIODS = Config.SINGLE_MA_PERIODS
const SMA_PERIOD = SINGLE_MA_PERIODS.SMA_PERIOD
const EMA_PERIOD = SINGLE_MA_PERIODS.EMA_PERIOD
const MA_CROSS_PERIODS = Config.MA_CROSS_PERIODS
const SMA_SLOW_PERIOD = MA_CROSS_PERIODS.SMA.SLOW
const SMA_FAST_PERIOD = MA_CROSS_PERIODS.SMA.FAST
const EMA_SLOW_PERIOD = MA_CROSS_PERIODS.EMA.SLOW
const EMA_FAST_PERIOD = MA_CROSS_PERIODS.EMA.FAST
const USE_SINGLE_MA = Config.USE_SINGLE_MA
const USE_MA_CROSS = Config.USE_MA_CROSS
const USE_SMA = Config.USE_SMA
const USE_EMA = Config.USE_EMA

// Y = slope * X + intercept
async function linearRegression (x_values, y_values) {
    let lr = {
        'slope': 0,
        'intercept': 0,
        'r2': 0,
    }
    let n = y_values.length
    let sum_x = 0
    let sum_y = 0
    let sum_xy = 0
    let sum_xx = 0
    let sum_yy = 0

    for (let i = 0; i < y_values.length; i++) {
        sum_x += x_values[i]
        sum_y += y_values[i]
        sum_xy += (x_values[i] * y_values[i])
        sum_xx += (x_values[i] * x_values[i])
        sum_yy += (y_values[i] * y_values[i])
    }

    lr.slope = (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x)
    // Commented intercept anc r2 to improve speed
    // lr.intercept = (sum_y - lr.slope * sum_x) / n
    // lr.r2 = Math.pow((n * sum_xy - sum_x * sum_y) / Math.sqrt((n * sum_xx - sum_x * sum_x) * (n * sum_yy - sum_y * sum_y)), 2)

    return lr
}

async function evaluateLinearTrend (interval, symbol, timeframe = SHORT_TERM) {
    let times = []
    let prices = []
    let price = 0
    let symbolData = await getStructuredData(interval, symbol, timeframe)
    for (let i = 0; i < symbolData.length; i++) {
        times.push(symbolData[i].closeTime)
        price = (parseFloat(symbolData[i].high) + parseFloat(symbolData[i].low) + parseFloat(symbolData[i].close)) / 3
        prices.push(price)
    }
    return await linearRegression(times, prices)
}

async function getStructuredData (interval, symbol, timeframe) {
    let symbolData
    let dataLength
    switch (timeframe) {
        case LONG_TERM:
            symbolData = await candlesManager.getCandlesBySymbol(LONG_TERM_CONFIG.interval, symbol)
            dataLength = symbolData.length
            return symbolData.slice(dataLength - LONG_TERM_CONFIG.candlesToAnalyze, dataLength)
        case MID_TERM:
            symbolData = await candlesManager.getCandlesBySymbol(MID_TERM_CONFIG.interval, symbol)
            dataLength = symbolData.length
            return symbolData.slice(dataLength - MID_TERM_CONFIG.candlesToAnalyze, dataLength)
        case SHORT_TERM:
            symbolData = await candlesManager.getCandlesBySymbol(SHORT_TERM_CONFIG.interval, symbol)
            dataLength = symbolData.length
            return symbolData.slice(dataLength - SHORT_TERM_CONFIG.candlesToAnalyze, dataLength)
        default:
            return await candlesManager.getCandlesBySymbol(interval, symbol)
    }
}

/**
 * NOTE: Following is used only for guide line: the trend is calculated on passed "interval" but the trend can be
 * calculated on weekly, daily, hourly ecc.
 * CLASSIFICATION    TRADING STYLE    TREND TIME FRAME    TRIGGER TIME FRAME
 * Long term        Position trading    Weekly            Daily
 * Medium term        Swing trader        Daily            4-hour
 * Short term        Day trading            4-hour            Hourly
 *                  Scalper                Hourly          15-minute
 */
async function isUptrend (interval, symbol, timeframe) {
    let trend = await evaluateLinearTrend(interval, symbol, timeframe)
    return trend.slope > 0
}

async function getTrendIntensity (interval, symbol, timeframe) {
    let trend = await evaluateLinearTrend(interval, symbol, timeframe)
    let intensity = Number(trend.slope) * Math.pow(10, 12)
    if (!isNaN(intensity)) {
        return intensity
    }
    return null
}

async function sortSymbolsByTrend (symbols) {
    let sortedSymbols = []
    let tmpSymbol = {}
    for (let i = 0; i < symbols.length; i++) {

        tmpSymbol = {
            'interval': symbols[i].interval,
            'symbol': symbols[i].symbol,
            'timeframe': symbols[i].timeframe,
            'trendIntensity': await getTrendIntensity(symbols[i].interval, symbols[i].symbol, symbols[i].timeframe),
        }
        sortedSymbols[i] = tmpSymbol
    }
    sortedSymbols.sort((a, b) => (Number(a.trendIntensity) < Number(b.trendIntensity)) ? 1 : -1)
    return sortedSymbols
}

async function isSMAUptrend (interval, symbol, SMAPeriod = SMA_PERIOD) {
    let price = await getLastCandlePrice(interval, symbol)
    let SMAValues = await symbolLogic.SMA(interval, symbol, SMAPeriod)
    return price > SMAValues[SMAValues.length - 1]
}

async function isEMAUptrend (interval, symbol, EMAPeriod = EMA_PERIOD) {
    let price = await getLastCandlePrice(interval, symbol)
    let EMAValues = await symbolLogic.EMA(interval, symbol, EMAPeriod)
    return price > EMAValues[EMAValues.length - 1]
}

async function isSMACrossUptrend (interval, symbol, SMASlowPeriod = SMA_SLOW_PERIOD, SMAFastPeriod = SMA_FAST_PERIOD) {
    let slowSMA = await symbolLogic.SMA(interval, symbol, SMASlowPeriod)
    let fastSMA = await symbolLogic.SMA(interval, symbol, SMAFastPeriod)
    return fastSMA[fastSMA.length - 1] > slowSMA[slowSMA.length - 1]
}

async function isEMACrossUptrend (interval, symbol, EMASlowPeriod = EMA_SLOW_PERIOD, EMAFastPeriod = EMA_FAST_PERIOD) {
    let slowEMA = await symbolLogic.EMA(interval, symbol, EMASlowPeriod)
    let fastEMA = await symbolLogic.EMA(interval, symbol, EMAFastPeriod)
    return fastEMA[fastEMA.length - 1] > slowEMA[slowEMA.length - 1]
}

async function getLastCandlePrice (interval, symbol) {
    let lastCandle = await candlesManager.getLastCandle(interval, symbol)
    let high = parseFloat(lastCandle.high)
    let low = parseFloat(lastCandle.low)
    let close = parseFloat(lastCandle.close)
    return (high + low + close) / 3
}

async function isMAStatusUptrend (interval, symbol) {
    if (USE_SINGLE_MA) {
        if (USE_SMA) {
            return await isSMAUptrend(interval, symbol)
        }
        if (USE_EMA) {
            return await isEMAUptrend(interval, symbol)
        }
    }
    if (USE_MA_CROSS) {
        if (USE_SMA) {
            return await isSMACrossUptrend(interval, symbol)
        }
        if (USE_EMA) {
            return await isEMACrossUptrend(interval, symbol)
        }
    }
    return false
}

module.exports = {
    LONG_TERM,
    MID_TERM,
    SHORT_TERM,
    isUptrend,
    getTrendIntensity,
    sortSymbolsByTrend,
    isSMAUptrend,
    isEMAUptrend,
    isSMACrossUptrend,
    isEMACrossUptrend,
    isMAStatusUptrend
}
