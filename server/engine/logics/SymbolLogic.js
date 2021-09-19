'use strict'

const supportsResistances = require('./SupportsResistances')
const takeProfitStopLoss = require('./TakeprofitStoploss')
const candlesManager = require('./CandlesManager')
const utils = require('../utils/utils')
const UNSET = 'UNSET'
const PERIOD_TOLERANCE = 3

const Config = require('../Config.json')
const USE_CACHE = Config.USE_CACHE
const runtimeCache = require('../utils/runtime-cache')
const BACKTESTING_MODE = Config.BACKTESTING.BACKTESTING_MODE

// Technical Indicators
const ti = require('technicalindicators')
ti.setConfig('precision', 8)

const {
    ADL,
    ADX,
    ATR,
    AwesomeOscillator,
    BollingerBands,
    CCI,
    ForceIndex,
    KST,
    MFI,
    MACD,
    OBV,
    PSAR,
    ROC,
    RSI,
    SMA,
    Stochastic,
    StochasticRSI,
    TRIX,
    VWAP,
    VolumeProfile,
    EMA,
    WMA,
    WEMA,
    WilliamsR,
    IchimokuCloud,
    CrossUp,
    CrossDown,
    CrossOver,
    SD,
    bullish,
    bearish
} = ti

//TODO use Promises

// Structure data from Binance candles data
async function getStructuredData(interval, symbol, period = UNSET) {
    let structuredData
    if (USE_CACHE && BACKTESTING_MODE) {
        structuredData = runtimeCache.getCache(runtimeCache.STRUCTURED + interval + symbol)
        if (!structuredData) {
            structuredData = await candlesManager.getCandlesBySymbol(interval, symbol, true)
                .then(async (rowData) => {
                    if (utils.isEmpty(rowData)) {
                        return null
                    }
                    const data = formatData(rowData)
                    if (data) {
                        runtimeCache.setCache(runtimeCache.STRUCTURED + interval + symbol, structuredData)
                    }
                    return data
                })
                .catch((error) => {
                    console.trace(error)
                })
            if (utils.isEmpty(structuredData)) {
                return null
            }
        }

        return syncCache(structuredData, interval, symbol)
    } else {
        return await candlesManager.getCandlesBySymbol(interval, symbol)
            .then(async (rowData) => {
                return formatData(rowData, period)
            })
            .catch((error) => {
                console.trace(error)
            })
    }
}

function syncCache(structuredData, interval, symbol) {
    if (!structuredData) {
        return {}
    }
    let syncedEpoch = candlesManager.getSyncedEpoch(interval)
    let syncedCache = runtimeCache.getCache(runtimeCache.SYNCED + interval + symbol)
    let itemNumberToSync = syncedEpoch
    if (syncedCache) {
        itemNumberToSync -= syncedCache.lastSyncedEpoch
    } else {
        syncedCache = {
            open: [],
            high: [],
            close: [],
            low: [],
            volume: [],
            price: [],
            openTime: [],
            values: 0,
            lastSyncedEpoch: 0
        }
    }

    const syncedStructures = syncStructuredData(structuredData, syncedCache, itemNumberToSync)

    runtimeCache.setCache(runtimeCache.STRUCTURED + interval + symbol, syncedStructures.structuredData)
    runtimeCache.setCache(runtimeCache.SYNCED + interval + symbol, syncedStructures.syncedCache)

    return syncedStructures.syncedCache
}

function syncStructuredData(structuredData, syncedCache, itemNumberToSync) {

    syncedCache.open = syncedCache.open.concat(structuredData.open.splice(0, itemNumberToSync))
    syncedCache.high = syncedCache.high.concat(structuredData.high.splice(0, itemNumberToSync))
    syncedCache.close = syncedCache.close.concat(structuredData.close.splice(0, itemNumberToSync))
    syncedCache.low = syncedCache.low.concat(structuredData.low.splice(0, itemNumberToSync))
    syncedCache.volume = syncedCache.volume.concat(structuredData.volume.splice(0, itemNumberToSync))
    syncedCache.price = syncedCache.price.concat(structuredData.price.splice(0, itemNumberToSync))
    syncedCache.openTime = syncedCache.openTime.concat(structuredData.openTime.splice(0, itemNumberToSync))

    if (syncedCache.values > 0) {
        syncedCache.open.splice(0, itemNumberToSync);
        syncedCache.high.splice(0, itemNumberToSync);
        syncedCache.close.splice(0, itemNumberToSync);
        syncedCache.low.splice(0, itemNumberToSync);
        syncedCache.volume.splice(0, itemNumberToSync);
        syncedCache.price.splice(0, itemNumberToSync);
        syncedCache.openTime.splice(0, itemNumberToSync);
    } else {
        syncedCache.values += itemNumberToSync
    }
    structuredData.values -= itemNumberToSync
    syncedCache.lastSyncedEpoch += itemNumberToSync

    return {structuredData, syncedCache}
}

function formatData(rowData, period = UNSET) {
    let price = 0
    let valuesToAnalyze
    let structuredData = {
        open: [],
        high: [],
        close: [],
        low: [],
        volume: [],
        price: [],
        openTime: [],
        values: 0
    }
    if (rowData && rowData.length > 0) {
        valuesToAnalyze = rowData.length
        if (period !== UNSET) {
            const adjustedPeriod = getAdjustedPeriod(period)
            if (adjustedPeriod < valuesToAnalyze) {
                period = adjustedPeriod
                valuesToAnalyze = adjustedPeriod
            } else {
                period = valuesToAnalyze
            }
        } else {
            period = valuesToAnalyze
        }
        let periodValue
        for (let i = 0; i < valuesToAnalyze; i++) {
            periodValue = rowData.length - period + i
            structuredData.open.push(parseFloat(rowData[periodValue].open))
            structuredData.high.push(parseFloat(rowData[periodValue].high))
            structuredData.close.push(parseFloat(rowData[periodValue].close))
            structuredData.low.push(parseFloat(rowData[periodValue].low))
            structuredData.volume.push(parseFloat(rowData[periodValue].volume))
            price = getOnceTypicalPrice(structuredData.high[i], structuredData.low[i], structuredData.close[i])
            structuredData.price.push(parseFloat(price))
            structuredData.openTime.push(rowData[periodValue].openTime)
            structuredData.values++
        }
    }
    return structuredData
}

function getAdjustedPeriod(period) {
    return ((period * 2) + PERIOD_TOLERANCE)
}

// Support Resistance Logic
async function getFloorPivot(interval, symbol) {
    const candlesData = await candlesManager.getCandlesBySymbol(interval, symbol)
    return await supportsResistances.calculateFloorPivot(candlesData)
}

async function getFibonacciPivot(interval, symbol, trendDirection) {
    const candlesData = await candlesManager.getCandlesBySymbol(interval, symbol)
    return await supportsResistances.calculateFibonacciPivot(candlesData, trendDirection)
}

// Indicators
async function getADL(interval, symbol, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    return ADL.calculate(values)
}

async function getADX(interval, symbol, period = 14, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'close': values.close,
        'high': values.high,
        'low': values.low,
        'period': period,
    }
    return ADX.calculate(input)
}

async function getATR(interval, symbol, period = 14, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'high': values.high,
        'low': values.low,
        'close': values.close,
        'period': period
    }
    return ATR.calculate(input)
}

async function getBollingerBands(interval, symbol, period = 14, stdDev = 1, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'period': period,
        'values': values.price,
        'stdDev': stdDev
    }
    return BollingerBands.calculate(input)
}

async function getCCI(interval, symbol, period = 14, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'open': values.open,
        'high': values.high,
        'low': values.low,
        'close': values.close,
        'period': period,
    }
    return CCI.calculate(input)
}

async function getAwesomeOscillator(interval, symbol, fastPeriod = 5, slowPeriod = 34, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'high': values.high,
        'low': values.low,
        'fastPeriod': fastPeriod,
        'slowPeriod': slowPeriod
    }
    return AwesomeOscillator.calculate(input)
}

async function getForceIndex(interval, symbol, period = 1, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'open': values.open,
        'high': values.high,
        'low': values.low,
        'close': values.close,
        'volume': values.volume,
        'period': period
    }
    return ForceIndex.calculate(input)
}

async function getKST(interval, symbol, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }

    const ROCPer1 = 10
    const ROCPer2 = 15
    const ROCPer3 = 20
    const ROCPer4 = 30
    const SMAROCPer1 = 10
    const SMAROCPer2 = 10
    const SMAROCPer3 = 10
    const SMAROCPer4 = 15
    const signalPeriod = 3
    const input = {
        'ROCPer1': ROCPer1,
        'ROCPer2': ROCPer2,
        'ROCPer3': ROCPer3,
        'ROCPer4': ROCPer4,
        'SMAROCPer1': SMAROCPer1,
        'SMAROCPer2': SMAROCPer2,
        'SMAROCPer3': SMAROCPer3,
        'SMAROCPer4': SMAROCPer4,
        'signalPeriod': signalPeriod,
        'values': values.close
    }
    return KST.calculate(input)
}

async function getMFI(interval, symbol, period = 14, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'high': values.high,
        'low': values.low,
        'close': values.close,
        'volume': values.volume,
        'period': period
    }
    return MFI.calculate(input)
}

async function getMACD(interval, symbol, fastPeriod = 5, slowPeriod = 8, signalPeriod = 3, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const SimpleMAOscillator = false
    const SimpleMASignal = false
    const input = {
        'values': values.price,
        'fastPeriod': fastPeriod,
        'slowPeriod': slowPeriod,
        'signalPeriod': signalPeriod,
        'SimpleMAOscillator': SimpleMAOscillator,
        'SimpleMASignal': SimpleMASignal
    }
    return MACD.calculate(input)
}

async function getOBV(interval, symbol, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'close': values.close,
        'volume': values.volume
    }
    return OBV.calculate(input)
}

async function getPSAR(interval, symbol, step = 0.02, max = 0.2, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }

    const input = {
        'high': values.high,
        'low': values.low,
        'step': step,
        'max': max
    }
    return PSAR.calculate(input)
}

async function getROC(interval, symbol, period = 12, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'values': values.price,
        'period': period
    }
    return ROC.calculate(input)
}

async function getRSI(interval, symbol, period = 14, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'values': values.price,
        'period': period
    }
    return RSI.calculate(input)
}

async function getSMA(interval, symbol, period = 8, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'values': values.price,
        'period': period
    }
    return SMA.calculate(input)
}

async function getStochastic(interval, symbol, period = 14, signalPeriod = 3, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'high': values.high,
        'low': values.low,
        'close': values.close,
        'period': period,
        'signalPeriod': signalPeriod
    }
    return Stochastic.calculate(input)
}

async function getStochasticRSI(interval, symbol, rsiPeriod = 14, stochasticPeriod = 14, values = null) {
    const period = (rsiPeriod > stochasticPeriod) ? rsiPeriod : stochasticPeriod
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const kPeriod = 3
    const dPeriod = 3
    const input = {
        'values': values.price,
        'rsiPeriod': rsiPeriod,
        'stochasticPeriod': stochasticPeriod,
        'kPeriod': kPeriod,
        'dPeriod': dPeriod,
    }
    return StochasticRSI.calculate(input)
}

async function getTRIX(interval, symbol, period = 14, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'values': values.close,
        'period': period
    }
    return TRIX.calculate(input)
}

async function getTypicalPrices(interval, symbol, period = null, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    return values.close
}

async function getVWAP(interval, symbol, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'open': values.open,
        'high': values.high,
        'low': values.low,
        'close': values.close,
        'volume': values.volume
    }
    return VWAP.calculate(input)
}

async function getVolumeProfile(interval, symbol, noOfBars = 14, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'open': values.open,
        'high': values.high,
        'low': values.low,
        'close': values.close,
        'volume': values.volume,
        'noOfBars': noOfBars
    }
    return VolumeProfile.calculate(input)
}

async function getEMA(interval, symbol, period = 8, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'values': values.close,
        'period': period
    }
    return EMA.calculate(input)
}

async function getWMA(interval, symbol, period = 8, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'values': values.price,
        'period': period
    }
    return WMA.calculate(input)
}

async function getWEMA(interval, symbol, period = 5, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'values': values.price,
        'period': period
    }
    return WEMA.calculate(input)
}

async function getWilliamsR(interval, symbol, period = 14, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'high': values.high,
        'low': values.low,
        'close': values.close,
        'period': period
    }
    return WilliamsR.calculate(input)
}

async function getIchimokuCloud(interval, symbol, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const conversionPeriod = 9
    const basePeriod = 26
    const spanPeriod = 52
    const displacement = 26
    const input = {
        'high': values.high,
        'low': values.low,
        'conversionPeriod': conversionPeriod,
        'basePeriod': basePeriod,
        'spanPeriod': spanPeriod,
        'displacement': displacement
    }
    return IchimokuCloud.calculate(input)
}

// Utils
async function getChandelierExitStatus(interval, symbol, period = 22) {
    const chandelierValue = await getChandelierValue(interval, symbol, period)
    const lastCandle = await candlesManager.getLastCandle(interval, symbol)
    if (lastCandle) {
        const closeValue = parseFloat(lastCandle.close)
        return closeValue < chandelierValue
    }
    return false
}

async function getChandelierValue(interval, symbol, period = 22) {
    const ATRValues = await getATR(interval, symbol) // TODO: try to remove period
    const ATR = ATRValues[ATRValues.length - 1]
    const higherHigh = await getHigherHigh(interval, symbol, period)
    return higherHigh - (ATR * 3)
}

async function getHigherHigh(interval, symbol, period = 30, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    let higherHigh = 0
    for (const record of values.high) {
        if (record > higherHigh) {
            higherHigh = record
        }
    }
    return higherHigh
}

async function getLowerLow(interval, symbol, period = 30, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    let lowerLow = 0
    for (const record of values.high) {
        if (record < lowerLow) {
            lowerLow = record
        }
    }
    return lowerLow
}

async function getCrossUp(lineA, lineB) {
    const input = {
        'lineA': lineA,
        'lineB': lineB
    }
    return CrossUp.calculate(input)
}

async function getCrossDown(lineA, lineB) {
    const input = {
        'lineA': lineA,
        'lineB': lineB
    }
    return CrossDown.calculate(input)
}

async function getCrossOver(lineA, lineB) {
    const input = {
        'lineA': lineA,
        'lineB': lineB
    }
    return CrossOver.calculate(input)
}

async function getSD(interval, symbol, period = 5, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    const input = {
        'values': values.price,
        'period': period
    }
    return SD.calculate(input)
}

function getOnceTypicalPrice(high, low, close) {
    high = parseFloat(high)
    low = parseFloat(low)
    close = parseFloat(close)

    const input = {
        'high': high,
        'low': low,
        'close': close
    }
    // TODO: remove return and use TypicalPrice
    return (input.high + input.low + input.close) / 3
    // return TypicalPrice(input)
}

//Patterns
async function isBullish(interval, symbol, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    return !!bullish(values)
}

async function isBearish(interval, symbol, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    return !!bearish(values)
}

async function getMomentum(interval, symbol, period = 14, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    let MOMENTUM = []
    let momentum = 0

    let actualPrice = 0
    let periodPrice = 0

    for (let i = 0; i < values.close.length - period; i++) {
        actualPrice = values.close[i + period]
        periodPrice = values.close[i]

        if (periodPrice !== 0) {
            momentum = (actualPrice / periodPrice) * 100
        } else {
            momentum = 0
        }
        MOMENTUM.push(momentum)
    }

    return MOMENTUM
}

async function getTSI(interval, symbol, fastPeriod = 13, slowPeriod = 25, signalPeriod = 13, values = null) {
    if (utils.isEmpty(values)) {
        values = await getStructuredData(interval, symbol)
        if (utils.isEmpty(values)) {
            return false
        }
    }
    let PC = []
    let APC = []
    let pc = 0
    let TSI = []
    let tsi = 0
    let doubleSmoothedPC = 0
    let doubleSmoothedAbsolutePC = 0
    let tsiValues = []

    console.log(values.close)
    for (let i = 0; i < values.close.length - 1; i++) {
        pc = parseFloat((values.close[i + 1] - values.close[i]).toFixed(5))
        PC.push(pc)
        APC.push(Math.abs(pc))
    }

    const firstSmoothingValues = EMA.calculate({
        'values': PC,
        'period': slowPeriod
    })
    const secondSmoothingValues = EMA.calculate({
        'values': firstSmoothingValues,
        'period': fastPeriod
    })

    const absoluteFirstSmoothingValues = EMA.calculate({
        'values': APC,
        'period': slowPeriod
    })
    const absoluteSecondSmoothingValues = EMA.calculate({
        'values': absoluteFirstSmoothingValues,
        'period': fastPeriod
    })


    console.log(PC)
    console.log(APC)
    console.log(firstSmoothingValues)
    console.log(absoluteFirstSmoothingValues)
    console.log(secondSmoothingValues)
    console.log(absoluteSecondSmoothingValues)


    for (let i = 0; i < secondSmoothingValues.length; i++) {
        doubleSmoothedPC = secondSmoothingValues[i]
        doubleSmoothedAbsolutePC = absoluteSecondSmoothingValues[i]
        tsi = 100 * doubleSmoothedPC / doubleSmoothedAbsolutePC
        tsiValues.push(tsi)
    }
    const signals = EMA.calculate({
        'values': tsiValues,
        'period': signalPeriod
    })

    console.log(firstSmoothingValues.length)
    console.log(secondSmoothingValues.length)
    console.log(absoluteFirstSmoothingValues.length)
    console.log(absoluteSecondSmoothingValues.length)
    console.log(tsiValues.length)
    console.log(tsiValues)
    console.log(signals.length)
    console.log(signals)

    for (let i = 0; i < tsiValues.length; i++) {
        console.log(signals[i])
        const structure = {
            tsi: tsiValues[i],
            signal: signals[i]
        }
        TSI.push(structure)
    }

    return TSI
}

module.exports = {
    UPTREND_DIRECTION: supportsResistances.UPTREND_DIRECTION,
    DOWNTREND_DIRECTION: supportsResistances.DOWNTREND_DIRECTION,
    BOTH_TREND_DIRECTION: supportsResistances.BOTH_TREND_DIRECTION,
    FloorPivot: getFloorPivot,
    FibonacciPivot: getFibonacciPivot,

    // Technical Indicators
    ADL: getADL,
    ADX: getADX,
    ATR: getATR,
    AwesomeOscillator: getAwesomeOscillator,
    BollingerBands: getBollingerBands,
    CCI: getCCI,
    ForceIndex: getForceIndex,
    KST: getKST,
    MFI: getMFI,
    MACD: getMACD,
    OBV: getOBV,
    PSAR: getPSAR,
    ROC: getROC,
    RSI: getRSI,
    SMA: getSMA,
    Stochastic: getStochastic,
    StochasticRSI: getStochasticRSI,
    TRIX: getTRIX,
    TypicalPrices: getTypicalPrices,
    VWAP: getVWAP,
    VolumeProfile: getVolumeProfile,
    EMA: getEMA,
    WMA: getWMA,
    WEMA: getWEMA,
    WilliamsR: getWilliamsR,
    IchimokuCloud: getIchimokuCloud,

    // Utils
    ChandelierExitStatus: getChandelierExitStatus,
    ChandelierValue: getChandelierValue,
    HigherHigh: getHigherHigh,
    LowerLow: getLowerLow,
    CrossUp: getCrossUp,
    CrossDown: getCrossDown,
    CrossOver: getCrossOver,
    SD: getSD,

    getOnceTypicalPrice: getOnceTypicalPrice,

    // Candlestick Patterns
    isBullish: isBullish,
    isBearish: isBearish,

    // Custom Indicators
    Momentum: getMomentum,
    TSI: getTSI,

    // Take Profit - Stop Loss
    takeProfit: takeProfitStopLoss.takeProfit,
    stopLoss: takeProfitStopLoss.stopLoss,
    evaluateStopLoss: takeProfitStopLoss.evaluateStopLoss,
    evaluateTakeProfit: takeProfitStopLoss.evaluateTakeProfit,
    evaluateStopLossAndTakeProfit: takeProfitStopLoss.evaluateStopLossAndTakeProfit
}
