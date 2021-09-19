'use strict'

const candleModel = require('../../mongodb/models/Candle')
const botClient = require('../binance-api/BotClient').botClient
const Config = require('../Config.json')
const BACKTESTING_MODE = Config.BACKTESTING.BACKTESTING_MODE
const BACKTESTING_START_TIMESTAMP = Config.BACKTESTING.START_TIMESTAMP
const BACKTESTING_END_TIMESTAMP = Config.BACKTESTING.END_TIMESTAMP
const BACKTESTING_TRADING_INTERVAL = Config.TRADING_INTERVAL
const REAL_TIME_MODE = Config.REAL_TIME_MODE
const USE_CACHE = Config.USE_CACHE
const CANDLES_DATA_REQUEST_LIMIT = 1000
const utils = require("../utils/utils");
const runtimeCache = require("../utils/runtime-cache");

const LOG_TAG = '\t[CANDLES-MANAGER]\t|\t'

let epoch = 1
let lastEpoch = 1000

if (BACKTESTING_MODE) {
    epoch = Config.BACKTESTING.STARTING_EPOCH + 1
    lastEpoch = calculateLastEpoch(Config.BACKTESTING.START_TIMESTAMP, Config.BACKTESTING.END_TIMESTAMP)
}

async function getCandlesBySymbol(interval, symbol, skipSync = false) {
    let candlesData
    let candlesDataStored = await candleModel.isCandleOfDB(interval, symbol)
    if (candlesDataStored) {
        candlesData = await getStoredCandlesData(interval, symbol)
    } else {
        candlesData = await getNewCandlesData(interval, symbol)
    }

    if (candlesData.length > 0) {
        if (BACKTESTING_MODE && !skipSync) {
            const syncedEpoch = getSyncedEpoch(interval)

            candlesData = candlesData.slice(0, syncedEpoch)
            return candlesData
        }

        if (!REAL_TIME_MODE) {
            candlesData = candlesData.slice(0, candlesData.length - 2)
        }
    } else {
        candlesData = []
    }
    return candlesData
}

function setEpoch(newEpoch) {
    epoch = newEpoch
}

function getEpoch() {
    return epoch
}

function getSyncedEpoch(requestedInterval) {
    const requestedTimestamp = utils.getTimestampByInterval(requestedInterval)
    const syncTimestamp = utils.getTimestampByInterval(BACKTESTING_TRADING_INTERVAL)

    if (requestedTimestamp === syncTimestamp) {
        return epoch
    } else {
        if (requestedTimestamp < syncTimestamp) {
            const timestampDiff = syncTimestamp / requestedTimestamp
            return timestampDiff * (epoch - 1)
        } else {
            const timestampDiff = requestedTimestamp / syncTimestamp
            return (epoch + 1) / timestampDiff
        }
    }
}

function getLastEpoch() {
    return lastEpoch
}

function calculateLastEpoch(startTimestamp, endTimestamp) {
    const timestampInterval = utils.getTimestampByInterval(BACKTESTING_TRADING_INTERVAL)
    const fixedStartTimestamp = startTimestamp - (startTimestamp % timestampInterval)
    const fixedEndTimestamp = endTimestamp - (endTimestamp % timestampInterval)
    const timestampDiff = fixedEndTimestamp - fixedStartTimestamp
    return Math.trunc(timestampDiff / timestampInterval)
}

async function getStoredCandlesData(interval, symbol) {
    if (USE_CACHE && BACKTESTING_MODE) {
        const cachedKey = runtimeCache.CANDLES + interval + symbol
        const cachedData = runtimeCache.getCache(cachedKey)
        if (cachedData) {
            return cachedData
        }
    }
    let historicalData
    historicalData = await getCandleHistoricalData(interval, symbol)
        .then(async (historicalData) => {
            return historicalData
        })
        .catch((error) => {
            console.trace(error)
            return {}
        })
    if (utils.isEmpty(historicalData)) {
        return {}
    }
    const lastCandleTimestamp = historicalData[historicalData.length - 1].openTime
    if (!BACKTESTING_MODE && isTimeToUpdate(interval, lastCandleTimestamp)) {
        historicalData = await getUpdatedCandlesData(interval, symbol)
            .then(async (historicalData) => {
                return historicalData
            })
            .catch((error) => {
                console.trace(error)
                return {}
            })
    }
    if (USE_CACHE && BACKTESTING_MODE && historicalData) {
        const cachedKey = runtimeCache.CANDLES + interval + symbol
        runtimeCache.setCache(cachedKey, historicalData)
    }
    return historicalData
}

async function getNewCandlesData(interval, symbol) {
    return await requestHistoricalCandlesData(interval, symbol)
        .then(async (historicalData) => {
            await addCandleHistoricalData(interval, symbol, historicalData)
            return historicalData
        })
        .catch((error) => {
            console.trace(error)
            return {}
        })
}

async function getUpdatedCandlesData(interval, symbol) { // TODO: update data not cancel entirely
    await candleModel.deleteOne(interval, symbol)
    return await getNewCandlesData(interval, symbol)
}

function isTimeToUpdate(interval, lastTimestamp) {
    const intervalTimestamp = utils.getTimestampByInterval(interval)
    const timeGap = Date.now() - lastTimestamp
    // If timeGap is more than interval and less than time per one cycle of bot.
    return (timeGap > intervalTimestamp)
}

async function isTimeToUpdateCandle(interval, symbol) {
    let lastCandle = await getLastCandle(interval, symbol)
    return isTimeToUpdate(interval, lastCandle.openTime)
}

async function requestHistoricalCandlesData(interval, symbol, startTime = null, endTime = null) {
    let payload = {
        interval: interval,
        symbol: symbol,
        limit: CANDLES_DATA_REQUEST_LIMIT,
    }

    if (BACKTESTING_MODE) {
        startTime = BACKTESTING_START_TIMESTAMP
        endTime = BACKTESTING_END_TIMESTAMP
    }

    if (!startTime && !endTime) {
        return await botClient.candles(payload)
            .then((data) => {
                return data
            })
            .catch((error) => {
                console.trace(error)
            })
    } else {
        payload.startTime = startTime

        let historicalData = []
        let windowCandles
        let lastCandle
        let lastCandleTimestamp
        const intervalTime = utils.getTimestampByInterval(interval)
        const windowIntervalTime = intervalTime * CANDLES_DATA_REQUEST_LIMIT

        do {
            if (payload.startTime + windowIntervalTime > endTime) {
                payload.endTime = endTime
            }
            windowCandles = await botClient.candles(payload)
                .then((data) => {
                    return data
                })
            if (windowCandles.length > 0) {
                historicalData = historicalData.concat(windowCandles)
                lastCandle = windowCandles[windowCandles.length - 1]
                lastCandleTimestamp = lastCandle.openTime
                payload.startTime = lastCandleTimestamp + intervalTime
            }
        } while (windowCandles.length >= CANDLES_DATA_REQUEST_LIMIT && lastCandleTimestamp < endTime - intervalTime)

        if (historicalData[0].openTime > startTime + intervalTime) {
            console.warn(LOG_TAG + 'No sufficient data. Ignoring: ' + symbol)
            return []
        } else {
            return historicalData
        }
    }
}

async function getCandleHistoricalData(interval, symbol) {
    return await candleModel.getCandleHistoricalData(interval, symbol)
        .then(async (data) => {
            return data
        })
        .catch((error) => {
            console.trace(error)
            return null
        })
}

async function addCandleHistoricalData(interval, symbol, historicalData) {
    const candleData = {
        interval: interval,
        symbol: symbol,
        historicalData: historicalData
    }
    return await candleModel.saveCandle({candleData})
        .then((status) => {
            return status
        })
        .catch((error) => {
            console.trace(error)
            return error
        })
}

async function getLastPrice(symbol) {
    if (BACKTESTING_MODE) {
        return await getLastCandle(Config.TRADING_INTERVAL, symbol)
            .then(async (lastCandleData) => {
                let close = parseFloat(lastCandleData.close)
                if (REAL_TIME_MODE) {
                    let high = parseFloat(lastCandleData.high)
                    let low = parseFloat(lastCandleData.low)
                    return ((high + low + close) / 3)
                } else {
                    return close
                }
            })
            .catch((error) => {
                console.trace(error)
            })
    }

    return await botClient.prices({
        symbol: symbol
    })
        .then(async (data) => {
            return data[symbol]
        })
        .catch((error) => {
            console.trace(error)
        })
}

async function getLastCandle(interval, symbol) {
    return await getCandlesBySymbol(interval, symbol)
        .then((candlesData) => {
            return candlesData[candlesData.length - 1]
        })
        .catch((error) => {
            console.trace(error)
        })
}

module.exports = {
    getCandlesBySymbol,
    isTimeToUpdate,
    requestHistoricalCandlesData,
    getCandleHistoricalData,
    addCandleHistoricalData,
    getLastPrice,
    getLastCandle,
    isTimeToUpdateCandle,
    getEpoch,
    getLastEpoch,
    setEpoch,
    getSyncedEpoch
}
