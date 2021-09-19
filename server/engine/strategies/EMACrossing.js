'use strict'

const JATB = require('../JATB')
const Config = JATB.Config
const BACKTESTING_MODE = Config.BACKTESTING.BACKTESTING_MODE
const REAL_TIME_MODE = Config.REAL_TIME_MODE
const ANALYZE_ALL_COINS = Config.ANALYZE_ALL_COINS
const FORCE_TREND_CHECK = Config.FORCE_TREND_CHECK
const MAX_TOP_COINS_TO_ANALYZE = Config.MAX_TOP_COINS_TO_ANALYZE
const UPTREND_INTENSITY_TRIGGER = Config.UPTREND_INTENSITY_TRIGGER
const TIME_TO_IGNORE_SYMBOL = Config.TIME_TO_IGNORE_SYMBOL
const TRADING_INTERVAL = Config.TRADING_INTERVAL // TODO set based on staticsymbol
const TRIGGER_INTERVAL = Config.TRIGGER_INTERVAL
const TREND_INTERVAL = Config.TREND_CONFIG.TREND_INTERVAL
const BUY_PERCENTAGE_GAP_TRIGGER = Config.BUY_PERCENTAGE_GAP_TRIGGER
const EMA_STRATEGY_PARAMS = Config.EMA_STRATEGY_PARAMS
const FAST_EMA_PERIOD = EMA_STRATEGY_PARAMS.FAST_EMA_PERIOD
const SLOW_EMA_PERIOD = EMA_STRATEGY_PARAMS.SLOW_EMA_PERIOD
const COMBINED_MODE = EMA_STRATEGY_PARAMS.COMBINED_MODE
const AVERAGE_MODE = EMA_STRATEGY_PARAMS.AVERAGE_MODE
const USE_OSCILLATOR = EMA_STRATEGY_PARAMS.USE_OSCILLATOR
const FAST_OSCILLATOR_PERIOD = EMA_STRATEGY_PARAMS.FAST_OSCILLATOR_PERIOD
const SLOW_OSCILLATOR_PERIOD = EMA_STRATEGY_PARAMS.SLOW_OSCILLATOR_PERIOD
const OSCILLATOR_PERIOD = EMA_STRATEGY_PARAMS.OSCILLATOR_PERIOD
const TREND_INTENSITY_ENABLED = Config.TREND_CONFIG.TREND_INTENSITY_ENABLED
const TREND_INTENSITY_SORTING = Config.TREND_CONFIG.TREND_INTENSITY_SORTING
const SINGLE_TRADE_MODE = Config.SINGLE_TRADE_MODE
const STRATEGY_NAME = 'EMACROSSING'
const NOT_INITIALIZED = 'NOT_INITIALIZED'
const LOG_TAG = '\t[' + STRATEGY_NAME + ']\t|\t'

const USE_ADX = EMA_STRATEGY_PARAMS.USE_ADX
const ADX_PERIOD = EMA_STRATEGY_PARAMS.ADX_PERIOD
const ADX_THRESHOLD = EMA_STRATEGY_PARAMS.ADX_THRESHOLD

let tradeToClose
let tradeToOpen
let openTrade

async function EMACrossing (symbolsToTrade) {
    tradeToClose = []
    tradeToOpen = []
    openTrade = await JATB.getOpenedTrades()
    await checkEMACrossingStatus(symbolsToTrade)
    if (openTrade) {
        await evaluateOpenTrade(openTrade)
    } else {
        await analyzeSymbolsToTrade(symbolsToTrade)
    }
    await JATB.evaluateOpenTradesReward()

    if (SINGLE_TRADE_MODE && tradeToOpen.length > 0) {
        tradeToOpen.splice(1)
    }
    if (BACKTESTING_MODE) {
        for (let i = 0; i < tradeToOpen.length; i++) {
            tradeToOpen[i].amount = 100
        }
    }

    return {
        'tradeToClose': tradeToClose,
        'tradeToOpen': tradeToOpen,
    }
}

async function evaluateOpenTrade (openTrade) {
    console.log(LOG_TAG + '[OPEN]\t' + openTrade.symbol + '\t----------')
    if (!await JATB.evaluateStopLoss(openTrade.symbol, JATB.MAX_AMOUNT)) {
        await tradeSymbol(openTrade.interval, openTrade.symbol)
    } else {
        console.log(LOG_TAG + 'Stop loss or take profit triggered')
        await JATB.setTimeToIgnore(openTrade.symbol, TIME_TO_IGNORE_SYMBOL)
    }
}

async function analyzeSymbolsToTrade (symbolsToTrade) {
    symbolsToTrade = await JATB.removeSymbolsToIgnore(symbolsToTrade)
    let sortedSymbols = await getSortedSymbols(symbolsToTrade)
    let maxCoinsToAnalyze = await getMaxCoinsToAnalyze(sortedSymbols)
    let i = 0
    while (!openTrade && i < maxCoinsToAnalyze) {
        // console.log('----------\t' + '[' + i + ']\t' + sortedSymbols[i].symbol)
        if (await isAnalyzable(sortedSymbols[i].interval, sortedSymbols[i].symbol, sortedSymbols[i].timeframe)) {
            await tradeSymbol(sortedSymbols[i].interval, sortedSymbols[i].symbol)
            openTrade = await JATB.getOpenedTrades()
        }
        i++
    }
}

async function isAnalyzable (interval, symbol, timeframe) { //check if is useful: isTrendBullish is in timeToBuy
    if (ANALYZE_ALL_COINS && !FORCE_TREND_CHECK) {
        return true
    }
    return await isTrendBullish(interval, symbol, timeframe)
}

async function getSortedSymbols (symbolsToTrade) {
    if (TREND_INTENSITY_SORTING) {
        return await JATB.sortSymbolsByTrend(symbolsToTrade)
    }
    return symbolsToTrade
}

async function getMaxCoinsToAnalyze (symbolsToAnalyze) {
    if (ANALYZE_ALL_COINS) {
        return symbolsToAnalyze.length
    }
    if (MAX_TOP_COINS_TO_ANALYZE > 0) {
        return MAX_TOP_COINS_TO_ANALYZE
    }
    return symbolsToAnalyze.length
}

async function checkEMACrossingStatus (symbols) {
    let lastShortPeriodEMAValue
    let lastLongPeriodEMAValue
    let crossingStatus
    let crossed
    let oldEMAStatus
    let interval
    let symbol
    let lastCheckCandleOpenTime
    let currentCandleOpenTime
    let skip = false

    for (let i = 0; i < symbols.length; i++) {
        interval = symbols[i].interval
        symbol = symbols[i].symbol
        oldEMAStatus = await getOldEMAStatus(interval, symbol)
        lastCheckCandleOpenTime = oldEMAStatus.lastCheckCandleOpenTime
        if (oldEMAStatus === NOT_INITIALIZED || await JATB.isTimeToUpdate(interval, lastCheckCandleOpenTime)) {
            lastShortPeriodEMAValue = await getLastEMAValue(interval, symbol, FAST_EMA_PERIOD)
            lastLongPeriodEMAValue = await getLastEMAValue(interval, symbol, SLOW_EMA_PERIOD)

            if (oldEMAStatus === NOT_INITIALIZED) {
                crossed = false
            } else {
                if (!oldEMAStatus.emaWereUptrend) {
                    crossed = lastShortPeriodEMAValue > lastLongPeriodEMAValue
                } else {
                    crossed = false
                }
            }
            currentCandleOpenTime = await JATB.getLastCandle(interval, symbol)
                .then((lastCandle) => {
                    if (lastCandle) {
                        return lastCandle.openTime
                    } else {
                        skip = true
                    }
                })

            if (skip) {
                skip = false
                continue
            }

            crossingStatus = {
                'crossed': crossed,
                'emaWereUptrend': lastShortPeriodEMAValue > lastLongPeriodEMAValue,
                'lastCheckCandleOpenTime': currentCandleOpenTime
            }
            await JATB.setStrategyUtils(symbol, STRATEGY_NAME, crossingStatus)
        }
    }
}

async function resetEMACrossingStatus (symbols) {
    console.log('Resetting EMA status')
    for (let i = 0; i < symbols.length; i++) {
        await JATB.setStrategyUtils(symbols[i].symbol, STRATEGY_NAME, {})
    }
}

async function tradeSymbol (interval, symbol) {
    let tradeNotExist = (await JATB.getTrade(symbol) === null) //TODO Remove null
    if (tradeNotExist) {
        await tryToBuy(interval, symbol)
    } else {
        await tryToSell(symbol)
    }
}

async function tryToBuy (interval, symbol) {
    //if (await isTimeToBuy('4h', symbol) && await isTimeToBuy(TRADING_INTERVAL, symbol)){ //&& !await isTimeToSell(TRIGGER_INTERVAL, symbol)) {
    if (await isTimeToBuy(TRADING_INTERVAL, symbol)) { //&& !await isTimeToSell(TRIGGER_INTERVAL, symbol)) {
        console.log(LOG_TAG + 'True bullish opportunity. Buying ' + symbol + '...')
        let trade = {
            'interval': interval,
            'symbol': symbol,
            'amount': await JATB.getSymbolQuoteAmount(symbol)
        }
        tradeToOpen.push(trade)
    }
}

async function isTimeToBuy (interval, symbol) {
    if (await emaIsBullish(interval, symbol)) {
        console.log(LOG_TAG + '[CROSSED]\t' + symbol)
        // Tested with pivot points but isTABullish include this check
        // return await pivotIsBullish(interval, symbol)
        if (USE_ADX) {
            return await isADXBullish(interval, symbol)
        } else if (USE_OSCILLATOR) {
            return await isOscillatorBullish(interval, symbol)
        } else {
            return true
        }
        //return await isTABullish(interval, symbol)
    }
    return false
}

async function isTABullish (interval, symbol) {
    return await JATB.isBullish(interval, symbol)
}

async function isTABearish (interval, symbol) {
    return await JATB.isBearish(interval, symbol)
}

async function isTrendBullish (interval, symbol, timeframe) {
    if (TREND_INTENSITY_ENABLED) {
        let trendIntensity = await JATB.getTrendIntensity(TREND_INTERVAL, symbol, timeframe)
        return (trendIntensity > UPTREND_INTENSITY_TRIGGER)
    }
    if (COMBINED_MODE) {
        // return await JATB.isMAStatusUptrend(interval, symbol) && isTABullish(interval, symbol)
        return await JATB.isMAStatusUptrend(TREND_INTERVAL, symbol) && await isTABullish(interval, symbol)
    }
    if (AVERAGE_MODE) {
        return await JATB.isMAStatusUptrend(TREND_INTERVAL, symbol)
        // return await JATB.isMAStatusUptrend(interval, symbol)
    }
    return await isTABullish(interval, symbol)
}

async function emaIsBullish (interval, symbol) {
    return await emasHaveCrossed(interval, symbol)
}

async function checkEMAGap (fastTimeEMAValue, slowTimeEMAValue) {
    let emaGap = fastTimeEMAValue - slowTimeEMAValue
    let emaPercentageGap = emaGap / fastTimeEMAValue * 100
    return (emaPercentageGap < BUY_PERCENTAGE_GAP_TRIGGER)
}

async function emasHaveCrossed (interval, symbol) {
    let oldEMAStatus = await getOldEMAStatus(interval, symbol)
    if (oldEMAStatus !== NOT_INITIALIZED) {
        if (oldEMAStatus.crossed === true) {
            return true
        }
    }
    return false
}

async function getOldEMAStatus (interval, symbol) {
    return await JATB.getStrategyUtils(symbol, STRATEGY_NAME)
        .then((utilsObject) => {
            if (Object.keys(utilsObject).length > 0) {
                return utilsObject
            }
            return NOT_INITIALIZED
        })
        .catch((error) => {
            console.trace(error)
            return error
        })
}

async function pivotIsBullish (interval, symbol) {
    let classicPivots = await JATB.FloorPivot(interval, symbol)
    let lastPrice = await JATB.getLastPrice(symbol)
    return (lastPrice <= classicPivots[classicPivots.length - 1].r2)
}

async function tryToSell (symbol) {
    if (await isTimeToSell(TRIGGER_INTERVAL, symbol)) {
        //console.log(LOG_TAG + 'Trend changed. Selling ' + symbol + '...')
        let trade = {
            'symbol': symbol,
            'amount': JATB.MAX_AMOUNT
        }
        tradeToClose.push(trade)
        await JATB.setTimeToIgnore(symbol, TIME_TO_IGNORE_SYMBOL)
    }
}

async function isTimeToSell (interval, symbol) {
    let lastFastPeriodEMA = await getLastEMAValue(interval, symbol, FAST_EMA_PERIOD)
    let lastSlowPeriodEMA = await getLastEMAValue(interval, symbol, SLOW_EMA_PERIOD)
    return lastFastPeriodEMA < lastSlowPeriodEMA // || !await isOscillatorBullish(interval, symbol) //|| await isTABearish(interval, symbol)
}

async function getLastEMAValue (interval, symbol, period) {
    return await JATB.EMA(interval, symbol, period)
        .then((emaValues) => {
            if (REAL_TIME_MODE) {
                return emaValues[emaValues.length - 1]
            } else {
                return emaValues[emaValues.length - 2]
            }
        })
        .catch((error) => {
            console.trace(error)
            return 0
        })
}

async function isOscillatorBullish (interval, symbol) {
    let oscillatorValues = await JATB.MACD(interval, symbol, FAST_OSCILLATOR_PERIOD, SLOW_OSCILLATOR_PERIOD, OSCILLATOR_PERIOD)
    let lastValue = oscillatorValues[oscillatorValues.length - 1]
    // let secondLastValue = oscillatorValues[oscillatorValues.length - 2]
    // return lastValue.MACD > secondLastValue.MACD
    return lastValue.MACD > lastValue.signal
}

async function isADXBullish (interval, symbol) {
    let ADXValues = await JATB.ADX(interval, symbol, ADX_PERIOD)
    let lastValue = ADXValues[ADXValues.length - 1]
    return lastValue.adx > ADX_THRESHOLD
}

module.exports = {
    strategy: EMACrossing
}
