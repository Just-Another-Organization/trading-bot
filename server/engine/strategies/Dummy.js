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
const TREND_INTENSITY_ENABLED = Config.TREND_CONFIG.TREND_INTENSITY_ENABLED
const TREND_INTENSITY_SORTING = Config.TREND_CONFIG.TREND_INTENSITY_SORTING
const SINGLE_TRADE_MODE = Config.SINGLE_TRADE_MODE
const STRATEGY_NAME = 'DUMMY'
const NOT_INITIALIZED = 'NOT_INITIALIZED'
const LOG_TAG = '\t[' + STRATEGY_NAME + ']\t|\t'

const DUMMY_STRATEGY_PARAMS = Config.DUMMY_STRATEGY_PARAMS
const BYPASS_TREND_CHECK = DUMMY_STRATEGY_PARAMS.BYPASS_TREND_CHECK
const OBVEMA_PERIOD = DUMMY_STRATEGY_PARAMS.OBVEMA_PERIOD
const RSI_PERIOD = DUMMY_STRATEGY_PARAMS.RSI_PERIOD
const RSI_OVERBOUGHT_THRESHOLD = DUMMY_STRATEGY_PARAMS.RSI_OVERBOUGHT_THRESHOLD
const RSI_OVERSOLD_THRESHOLD = DUMMY_STRATEGY_PARAMS.RSI_OVERSOLD_THRESHOLD
const MFI_PERIOD = DUMMY_STRATEGY_PARAMS.MFI_PERIOD
const MFI_OVERBOUGHT_THRESHOLD = DUMMY_STRATEGY_PARAMS.MFI_OVERBOUGHT_THRESHOLD
const MFI_OVERSOLD_THRESHOLD = DUMMY_STRATEGY_PARAMS.MFI_OVERSOLD_THRESHOLD
const CCI_PERIOD = DUMMY_STRATEGY_PARAMS.CCI_PERIOD
const CCI_OVERBOUGHT_THRESHOLD = DUMMY_STRATEGY_PARAMS.CCI_OVERBOUGHT_THRESHOLD
const CCI_OVERSOLD_THRESHOLD = DUMMY_STRATEGY_PARAMS.CCI_OVERSOLD_THRESHOLD
const WR_PERIOD = DUMMY_STRATEGY_PARAMS.WR_PERIOD
const WR_OVERBOUGHT_THRESHOLD = DUMMY_STRATEGY_PARAMS.WR_OVERBOUGHT_THRESHOLD
const WR_OVERSOLD_THRESHOLD = DUMMY_STRATEGY_PARAMS.WR_OVERSOLD_THRESHOLD
const ADX_PERIOD = DUMMY_STRATEGY_PARAMS.ADX_PERIOD
const ADX_THRESHOLD = DUMMY_STRATEGY_PARAMS.ADX_THRESHOLD
const USE_MACD = DUMMY_STRATEGY_PARAMS.USE_MACD
const MACD_FAST_PERIOD = DUMMY_STRATEGY_PARAMS.MACD_FAST_PERIOD
const MACD_SLOW_PERIOD = DUMMY_STRATEGY_PARAMS.MACD_SLOW_PERIOD
const MACD_PERIOD = DUMMY_STRATEGY_PARAMS.MACD_PERIOD
const STOCHASTIC_PERIOD = DUMMY_STRATEGY_PARAMS.STOCHASTIC_PERIOD
const STOCHASTIC_OVERBOUGHT_THRESHOLD = DUMMY_STRATEGY_PARAMS.STOCHASTIC_OVERBOUGHT_THRESHOLD
const STOCHASTIC_OVERSOLD_THRESHOLD = DUMMY_STRATEGY_PARAMS.STOCHASTIC_OVERBOUGHT_THRESHOLD

const COMBINED_MODE = DUMMY_STRATEGY_PARAMS.COMBINED_MODE
const AVERAGE_MODE = DUMMY_STRATEGY_PARAMS.AVERAGE_MODE
const CHANDELIER_PERIOD = DUMMY_STRATEGY_PARAMS.CHANDELIER_PERIOD
const CHANDELIER_STOP_ONLY = DUMMY_STRATEGY_PARAMS.CHANDELIER_STOP_ONLY
const FAST_EMA_PERIOD = DUMMY_STRATEGY_PARAMS.FAST_EMA_PERIOD
const SLOW_EMA_PERIOD = DUMMY_STRATEGY_PARAMS.SLOW_EMA_PERIOD

const RANK_SCORE_THRESHOLD = DUMMY_STRATEGY_PARAMS.RANK_SCORE_THRESHOLD

const USE_DEFAULT_STOP_STRATEGY = Config.STOP_LOSS_TAKE_PROFIT.USE_DEFAULT_STOP_STRATEGY

const MARKET_TREND_INTERVAL = Config.MARKET_TREND_INTERVAL
const MARKET_TREND_CHECK = Config.MARKET_TREND_CHECK
const BTC_SYMBOL = 'BTCUSDT'

let tradeToClose
let tradeToOpen
let openTrades

let symbolsToTrade

async function Dummy(symbolsList) {
    symbolsToTrade = [...symbolsList]
    tradeToClose = []
    tradeToOpen = []
    openTrades = await JATB.getOpenedTrades()

    if (openTrades.length > 0) {
        let openTrade
        let symbolToTrade

        for (let i = 0; i < openTrades.length; i++) {
            openTrade = openTrades[i]
            await evaluateOpenTrade(openTrade)

            for (let j = 0; j < symbolsToTrade.length; j++) {
                symbolToTrade = symbolsToTrade[j]
                if (symbolToTrade.symbol === openTrade.symbol) {
                    symbolsToTrade.splice(j, 1)
                }
            }
        }
    }

    if (await isNotMarketBearish()) {
        console.log(LOG_TAG + '[MARKET]\t' + 'BULLISH' + '\t----------')
        await analyzeSymbolsToTrade(symbolsToTrade)
    } else {
        console.log(LOG_TAG + '[MARKET]\t' + 'BEARISH' + '\t----------')
    }

    await JATB.evaluateOpenTradesReward()

    if (SINGLE_TRADE_MODE && tradeToOpen.length > 0) {
        tradeToOpen.splice(1)
    }

    // for (let i = 0; i < tradeToOpen.length; i++) {
    //     const trade =  tradeToOpen[i]
    //     const rankStatus = await getRankStatus(trade.symbol)
    //     console.log(rankStatus)
    //     printRank(rankStatus.signals, trade.symbol)
    //     console.log(rankStatus.cumulativeRank)
    // }
    for (let i = 0; i < tradeToClose.length; i++) {
        const trade = tradeToClose[i]
        const rankStatus = await getRankStatus(trade.symbol)
        printRank(rankStatus.signals, trade.symbol)
        console.log(rankStatus)
    }

    return {
        'tradeToClose': tradeToClose,
        'tradeToOpen': tradeToOpen,
    }
}

async function isNotMarketBearish() {
    if (!MARKET_TREND_CHECK) {
        return true
    } else {
        return !await isTABearish(MARKET_TREND_INTERVAL, BTC_SYMBOL)
    }
}

async function evaluateOpenTrade(openTrade) {
    console.log(LOG_TAG + '[OPEN]\t' + openTrade.symbol + '\t----------')
    if (!USE_DEFAULT_STOP_STRATEGY) {
        await tryToSell(openTrade.symbol)
    } else {
        if (!await JATB.evaluateStopLoss(openTrade.symbol, JATB.MAX_AMOUNT)) {
            await tryToSell(openTrade.symbol)
        } else {
            console.log(LOG_TAG + 'Stop loss or take profit triggered')
            // await JATB.setTimeToIgnore(openTrade.symbol, TIME_TO_IGNORE_SYMBOL)
        }
    }
}

async function analyzeSymbolsToTrade(symbolsToTrade) {
    // symbolsToTrade = await JATB.removeSymbolsToIgnore(symbolsToTrade)
    let sortedSymbols = await getSortedSymbols(symbolsToTrade)
    let maxCoinsToAnalyze = await getMaxCoinsToAnalyze(sortedSymbols)
    let ranks = []
    let i = 0
    const openableTrades = await JATB.getOpenableTradesNumber()
    if (openableTrades > 0) {
        while (i < maxCoinsToAnalyze && i < symbolsToTrade.length) {
            // console.log('----------\t' + '[' + (i + 1) + ']\t' + sortedSymbols[i].symbol)
            if (await isAnalyzable(sortedSymbols[i].interval, sortedSymbols[i].symbol, sortedSymbols[i].timeframe)) {
                const rankedTrade = await getRankedSymbol(sortedSymbols[i].interval, sortedSymbols[i].symbol)
                ranks.push(rankedTrade)
            }
            i++
        }
        ranks.sort((a, b) => (a.rank < b.rank) ? 1 : ((b.rank < a.rank) ? -1 : 0))
        // console.log(ranks)
        // printRankCounters()

        for (let j = 0; j < openableTrades; j++) {
            if (ranks[j] && ranks[j].rank > RANK_SCORE_THRESHOLD) {
                // console.log('OPENING RANK: ' + ranks[j].rank)
                tradeToOpen.push(ranks[j])
            } else {
                break
            }
        }
    }
}

async function isAnalyzable(interval, symbol, timeframe) { //check if is useful: isTrendBullish is in timeToBuy
    if (ANALYZE_ALL_COINS && !FORCE_TREND_CHECK) {
        return true
    }
    return await isTrendBullish(interval, symbol, timeframe)
}

async function getSortedSymbols(symbolsToTrade) {
    if (TREND_INTENSITY_SORTING) {
        return await JATB.sortSymbolsByTrend(symbolsToTrade)
    }
    return symbolsToTrade
}

async function getMaxCoinsToAnalyze(symbolsToAnalyze) {
    if (ANALYZE_ALL_COINS) {
        return symbolsToAnalyze.length
    }
    if (MAX_TOP_COINS_TO_ANALYZE > 0) {
        return MAX_TOP_COINS_TO_ANALYZE
    }
    return symbolsToAnalyze.length
}

async function getRankedSymbol(interval, symbol) {
    let trade = {
        interval,
        symbol,
        rank: 0
    }
    if (!await isTimeToSell(interval, symbol)) {
        // console.log(LOG_TAG + 'True bullish opportunity. Buying ' + symbol + '...')
        trade.rank = await getPositiveIndicatorsNumber(TRADING_INTERVAL, symbol)
    }
    return trade
}

async function getPositiveIndicatorsNumber(interval, symbol) {
    const ADL = await isADLBullish(interval, symbol)
    const ADX = await isADXBullish(interval, symbol)
    const ATR = await isATRBullish(interval, symbol)
    const AwesomeOscillator = await isAwesomeOscillatorBullish(interval, symbol)
    const BollingerBands = await isBollingerBandsBullish(interval, symbol)
    const CCI = await isCCIBullish(interval, symbol)
    const ForceIndex = await isForceIndexBullish(interval, symbol)
    const KST = await isKSTBullish(interval, symbol)
    const MFI = await isMFIBullish(interval, symbol)
    const MACD = await isMACDBullish(interval, symbol)
    const OBV = await isOBVBullish(interval, symbol)
    // const PSAR = await isPSARBullish(interval, symbol)
    const ROC = await isROCBullish(interval, symbol)
    const RSI = await isRSIBullish(interval, symbol)
    const SMA = await isSMABullish(interval, symbol)
    const Stochastic = await isStochasticBullish(interval, symbol)
    const StochasticRSI = await isStochasticRSIBullish(interval, symbol)
    const TRIX = await isTRIXBullish(interval, symbol)
    const VWAP = await isVWAPBullish(interval, symbol)
    const VolumeProfile = await isVolumeProfileBullish(interval, symbol)
    const EMA = await isEMABullish(interval, symbol)
    const WMA = await isWMABullish(interval, symbol)
    const WEMA = await isWEMABullish(interval, symbol)
    const WilliamsR = await isWilliamsRBullish(interval, symbol)
    const IchimokuCloud = await isIchimokuCloudBullish(interval, symbol)
    const SD = await isSDBullish(interval, symbol)

    const signals = [ADL, ADX, ATR, AwesomeOscillator, BollingerBands, CCI, ForceIndex, KST, MFI, MACD, OBV, //PSAR,
        ROC, RSI, SMA, Stochastic, StochasticRSI, TRIX, VWAP, VolumeProfile, EMA, WMA, WEMA, WilliamsR,
        IchimokuCloud, SD]

    // printRank(signals, symbol)

    const cumulativeRank = calculateRank(signals)
    const rankStatus = {
        cumulativeRank,
        signals
    }
    await setRankStatus(symbol, rankStatus)

    return cumulativeRank
}

let rankCounters = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

function printRankCounters() {
    console.log('---------------COUNTERS---------------')
    console.log('ADL:               ' + rankCounters[0])
    console.log('ADX:               ' + rankCounters[1])
    console.log('ATR:               ' + rankCounters[2])
    console.log('AwesomeOscillator: ' + rankCounters[3])
    console.log('BollingerBands:    ' + rankCounters[4])
    console.log('CCI:               ' + rankCounters[5])
    console.log('ForceIndex:        ' + rankCounters[6])
    console.log('KST:               ' + rankCounters[7])
    console.log('MFI:               ' + rankCounters[8])
    console.log('MACD:              ' + rankCounters[9])
    console.log('OBV:               ' + rankCounters[10])
    // console.log('PSAR:              ' + rankCounters[11])
    console.log('ROC:               ' + rankCounters[11])
    console.log('RSI:               ' + rankCounters[12])
    console.log('SMA:               ' + rankCounters[13])
    console.log('Stochastic:        ' + rankCounters[14])
    console.log('StochasticRSI:     ' + rankCounters[15])
    console.log('TRIX:              ' + rankCounters[16])
    console.log('VWAP:              ' + rankCounters[17])
    console.log('VolumeProfile:     ' + rankCounters[18])
    console.log('EMA:               ' + rankCounters[19])
    console.log('WMA:               ' + rankCounters[20])
    console.log('WEMA:              ' + rankCounters[21])
    console.log('WilliamsR:         ' + rankCounters[22])
    console.log('IchimokuCloud:     ' + rankCounters[23])
    console.log('SD:                ' + rankCounters[24])
    console.log('---------------COUNTERS---------------')
}

function printRank(ranks, symbol) {
    console.log('---------------RANK---------------')
    console.log('Symbol: ' + symbol)
    console.log('ADL:               ' + ranks[0])
    console.log('ADX:               ' + ranks[1])
    console.log('ATR:               ' + ranks[2])
    console.log('AwesomeOscillator: ' + ranks[3])
    console.log('BollingerBands:    ' + ranks[4])
    console.log('CCI:               ' + ranks[5])
    console.log('ForceIndex:        ' + ranks[6])
    console.log('KST:               ' + ranks[7])
    console.log('MFI:               ' + ranks[8])
    console.log('MACD:              ' + ranks[9])
    console.log('OBV:               ' + ranks[10])
    // console.log('PSAR:              ' + ranks[11])
    console.log('ROC:               ' + ranks[11])
    console.log('RSI:               ' + ranks[12])
    console.log('SMA:               ' + ranks[13])
    console.log('Stochastic:        ' + ranks[14])
    console.log('StochasticRSI:     ' + ranks[15])
    console.log('TRIX:              ' + ranks[16])
    console.log('VWAP:              ' + ranks[17])
    console.log('VolumeProfile:     ' + ranks[18])
    console.log('EMA:               ' + ranks[19])
    console.log('WMA:               ' + ranks[20])
    console.log('WEMA:              ' + ranks[21])
    console.log('WilliamsR:         ' + ranks[22])
    console.log('IchimokuCloud:     ' + ranks[23])
    console.log('SD:                ' + ranks[24])
    console.log('---------------RANK---------------')
}

async function setRankStatus(symbol, rankStatus) {
    await JATB.setStrategyUtils(symbol, STRATEGY_NAME, rankStatus)
}

async function getRankStatus(symbol) {
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

function calculateRank(signals) {
    let rank = 0
    for (let i = 0; i < signals.length; i++) {
        const bullishSignal = signals[i]
        if (bullishSignal) {
            rank++
            rankCounters[i]++
        }
    }
    return rank
}

async function isTABullish(interval, symbol) {
    return await JATB.isBullish(interval, symbol)
}

async function isTABearish(interval, symbol) {
    return await JATB.isBearish(interval, symbol)
}

async function isTrendBullish(interval, symbol, timeframe) {
    if (BYPASS_TREND_CHECK) {
        return true
    }
    if (TREND_INTENSITY_ENABLED) {
        let trendIntensity = await JATB.getTrendIntensity(TREND_INTERVAL, symbol, timeframe)
        return (trendIntensity > UPTREND_INTENSITY_TRIGGER)
    }
    if (COMBINED_MODE) {
        return await JATB.isMAStatusUptrend(TREND_INTERVAL, symbol) && await isTABullish(interval, symbol)
    }
    if (AVERAGE_MODE) {
        return await JATB.isMAStatusUptrend(TREND_INTERVAL, symbol)
    }
    return await isTABullish(interval, symbol)
}

async function tryToSell(symbol) {
    if (await isTimeToSell(TRIGGER_INTERVAL, symbol)) {
        // console.log(LOG_TAG + 'Trend changed. Selling ' + symbol + '...')
        const trade = {
            'symbol': symbol,
            'amount': JATB.MAX_AMOUNT
        }
        tradeToClose.push(trade)
        // await JATB.setTimeToIgnore(symbol, TIME_TO_IGNORE_SYMBOL)
    }
}

async function isTimeToSell(interval, symbol) {
    if (CHANDELIER_STOP_ONLY) {
        return await JATB.ChandelierExitStatus(interval, symbol, CHANDELIER_PERIOD)
    } else {
        return !await isPSARBearish(interval, symbol)
    }
}

async function isPSARBearish(interval, symbol) {
    const PSARValues = await getPSARValues(interval, symbol)
    const lastValue = PSARValues[PSARValues.length - 1]
    const lastPrice = await JATB.getLastPrice(symbol)

    return lastValue > lastPrice
}


async function isADLBullish(interval, symbol) {
    const ADLValues = await getADLValues(interval, symbol)
    const lastValue = ADLValues[ADLValues.length - 1]
    const secondLastValue = ADLValues[ADLValues.length - 2]
    const thirdLastValue = ADLValues[ADLValues.length - 3]

    return lastValue > secondLastValue > thirdLastValue
}

async function isADXBullish(interval, symbol) {
    const ADXValues = await getADXValues(interval, symbol)
    const lastValue = ADXValues[ADXValues.length - 1]
    const secondLastValue = ADXValues[ADXValues.length - 2]
    const thirdLastValue = ADXValues[ADXValues.length - 3]
    if (lastValue && secondLastValue && thirdLastValue) {
        return lastValue.adx < secondLastValue.adx < thirdLastValue.adx && lastValue.pdi > lastValue.mdi
    }
    return false
}

async function isATRBullish(interval, symbol) {
    const ATRValues = await getATRValues(interval, symbol)
    const lastValue = ATRValues[ATRValues.length - 1]
    const secondLastValue = ATRValues[ATRValues.length - 2]
    const thirdLastValue = ATRValues[ATRValues.length - 3]

    return lastValue > secondLastValue > thirdLastValue
}

async function isAwesomeOscillatorBullish(interval, symbol) {
    const awesomeOscillatorValues = await getAwesomeOscillatorValues(interval, symbol)
    const lastValue = awesomeOscillatorValues[awesomeOscillatorValues.length - 1]

    return lastValue > 0
}

async function isBollingerBandsBullish(interval, symbol) {
    const bollingerBandsValues = await getBollingerBandsValues(interval, symbol)
    const lastValue = bollingerBandsValues[bollingerBandsValues.length - 1]
    const lastPrice = await JATB.getLastPrice(symbol)

    return lastValue.lower > lastPrice

}

async function isCCIBullish(interval, symbol) {
    const CCIValues = await getCCIValues(interval, symbol)
    const lastValue = CCIValues[CCIValues.length - 1]
    const secondLastValue = CCIValues[CCIValues.length - 2]
    const thirdLastValue = CCIValues[CCIValues.length - 3]

    return lastValue < secondLastValue < thirdLastValue
}

async function isForceIndexBullish(interval, symbol) {
    const forceIndexValues = await getForceIndexValues(interval, symbol)
    const lastValue = forceIndexValues[forceIndexValues.length - 1]

    return lastValue > 0
}

async function isKSTBullish(interval, symbol) {
    const KSTValues = await getKSTValues(interval, symbol)
    const lastValue = KSTValues[KSTValues.length - 1]

    return lastValue.kst > lastValue.signal
}

async function isMFIBullish(interval, symbol) {
    const MFIValues = await getMFIValues(interval, symbol)
    const lastValue = MFIValues[MFIValues.length - 1]
    const secondLastValue = MFIValues[MFIValues.length - 2]
    const thirdLastValue = MFIValues[MFIValues.length - 3]

    return lastValue < secondLastValue < thirdLastValue
}

async function isMACDBullish(interval, symbol) {
    const MACDValues = await getMACDValues(interval, symbol)
    const lastValue = MACDValues[MACDValues.length - 1]
    const secondLastValue = MACDValues[MACDValues.length - 2]
    const thirdLastValue = MACDValues[MACDValues.length - 3]
    return lastValue.MACD > secondLastValue.MACD > thirdLastValue.MACD
}

async function isOBVBullish(interval, symbol) {
    const OBVValues = await getOBVValues(interval, symbol)
    const lastValue = OBVValues[OBVValues.length - 1]
    const secondLastValue = OBVValues[OBVValues.length - 2]
    const thirdLastValue = OBVValues[OBVValues.length - 3]

    // const OBVEMAValues = await JATB.EMA(interval, symbol, OBVEMA_PERIOD, OBVValues)
    // const lastOBVEMA = OBVEMAValues[OBVEMAValues.length - 1]
    // return lastValue > lastOBVEMA
    return lastValue < secondLastValue < thirdLastValue
}

async function isPSARBullish(interval, symbol) {
    const PSARValues = await getPSARValues(interval, symbol)
    const lastValue = PSARValues[PSARValues.length - 1]
    const secondLastValue = PSARValues[PSARValues.length - 2]

    const prices = await JATB.TypicalPrices(interval, symbol, 3)
    const lastPrice = prices[prices.length - 1]
    const secondLastPrice = prices[prices.length - 2]

    return lastValue < lastPrice && secondLastValue > secondLastPrice
}

async function isROCBullish(interval, symbol) {
    const ROCValues = await getROCValues(interval, symbol)
    const lastValue = ROCValues[ROCValues.length - 1]

    return lastValue > 0
}

async function isRSIBullish(interval, symbol) {
    const RSIValues = await getRSIValues(interval, symbol)
    const lastValue = RSIValues[RSIValues.length - 1]
    const secondLastValue = RSIValues[RSIValues.length - 2]
    const thirdLastValue = RSIValues[RSIValues.length - 3]

    return lastValue < secondLastValue < thirdLastValue
}

async function isSMABullish(interval, symbol) {
    const SMAValues = await getSMAValues(interval, symbol)
    const lastValue = SMAValues[SMAValues.length - 1]

    const lastPrice = await JATB.getLastPrice(symbol)

    return lastPrice > lastValue
}

async function isStochasticBullish(interval, symbol) {
    const stochasticValues = await getStochasticValues(interval, symbol)

    const lastValue = stochasticValues[stochasticValues.length - 1]
    const lastK = lastValue.k
    const lastD = lastValue.d
    return lastK > lastD && lastK < STOCHASTIC_OVERSOLD_THRESHOLD

}

async function isStochasticRSIBullish(interval, symbol) {
    const stochasticRSIValues = await getStochasticRSIValues(interval, symbol)

    const lastValue = stochasticRSIValues[stochasticRSIValues.length - 1].stochRSI
    const secondLastValue = stochasticRSIValues[stochasticRSIValues.length - 2].stochRSI
    const thirdLastValue = stochasticRSIValues[stochasticRSIValues.length - 3].stochRSI

    return lastValue < secondLastValue < thirdLastValue
}

async function isTRIXBullish(interval, symbol) {
    const TRIXValues = await getTRIXValues(interval, symbol)
    const lastValue = TRIXValues[TRIXValues.length - 1]

    return lastValue > 0
}

async function isVWAPBullish(interval, symbol) {
    const VWAPValues = await getVWAPValues(interval, symbol)
    const lastValue = VWAPValues[VWAPValues.length - 1]

    const lastPrice = await JATB.getLastPrice(symbol)

    return lastPrice > lastValue
}

async function isVolumeProfileBullish(interval, symbol) {
    const volumeProfileValues = await getVolumeProfileValues(interval, symbol)
    const lastValue = volumeProfileValues[volumeProfileValues.length - 1]

    return lastValue.bullishVolume > lastValue.bearishVolume
}

async function isEMABullish(interval, symbol) {
    const EMAValues = await getEMAValues(interval, symbol)
    const lastValue = EMAValues[EMAValues.length - 1]

    const lastPrice = await JATB.getLastPrice(symbol)
    return lastPrice > lastValue
}

async function isWMABullish(interval, symbol) {
    const WMAValues = await getWMAValues(interval, symbol)
    const lastValue = WMAValues[WMAValues.length - 1]

    const lastPrice = await JATB.getLastPrice(symbol)
    return lastPrice > lastValue
}

async function isWEMABullish(interval, symbol) {
    const WEMAValues = await getWEMAValues(interval, symbol)
    const lastValue = WEMAValues[WEMAValues.length - 1]

    const lastPrice = await JATB.getLastPrice(symbol)
    return lastPrice > lastValue
}

async function isWilliamsRBullish(interval, symbol) {
    const WRValues = await getWilliamsRValues(interval, symbol)
    const lastValue = WRValues[WRValues.length - 1]
    const secondLastValue = WRValues[WRValues.length - 2]
    const thirdLastValue = WRValues[WRValues.length - 3]
    return lastValue > secondLastValue > thirdLastValue
}

async function isIchimokuCloudBullish(interval, symbol) {
    const ichimokuCloudsValues = await getIchimokuCloudValues(interval, symbol)
    const lastValue = ichimokuCloudsValues[ichimokuCloudsValues.length - 1]

    const lastPrice = await JATB.getLastPrice(symbol)

    return lastPrice > lastValue.base && lastValue.conversion > lastValue.base
}

async function isSDBullish(interval, symbol) {
    const SDValues = await getSDValues(interval, symbol)
    const lastValue = SDValues[SDValues.length - 1]
    const secondLastValue = SDValues[SDValues.length - 2]
    const thirdLastValue = SDValues[SDValues.length - 3]
    return lastValue < secondLastValue < thirdLastValue
}


async function getADLValues(interval, symbol) {
    return await JATB.ADL(interval, symbol)
}

async function getADXValues(interval, symbol) {
    return await JATB.ADX(interval, symbol, ADX_PERIOD)
}

async function getATRValues(interval, symbol) {
    return await JATB.ATR(interval, symbol)
}

async function getAwesomeOscillatorValues(interval, symbol) {
    return await JATB.AwesomeOscillator(interval, symbol)
}

async function getBollingerBandsValues(interval, symbol) {
    return await JATB.BollingerBands(interval, symbol)
}

async function getCCIValues(interval, symbol) {
    return await JATB.CCI(interval, symbol, CCI_PERIOD)
}

async function getForceIndexValues(interval, symbol) {
    return await JATB.ForceIndex(interval, symbol)
}

async function getKSTValues(interval, symbol) {
    return await JATB.KST(interval, symbol)
}

async function getMFIValues(interval, symbol) {
    return await JATB.MFI(interval, symbol, MFI_PERIOD)
}

async function getMACDValues(interval, symbol) {
    return await JATB.MACD(interval, symbol, MACD_FAST_PERIOD, MACD_SLOW_PERIOD, MACD_PERIOD)
}

async function getOBVValues(interval, symbol) {
    return await JATB.OBV(interval, symbol)
}

async function getPSARValues(interval, symbol) {
    return await JATB.PSAR(interval, symbol)
}

async function getROCValues(interval, symbol) {
    return await JATB.ROC(interval, symbol)
}

async function getRSIValues(interval, symbol) {
    return await JATB.RSI(interval, symbol, RSI_PERIOD)
}

async function getSMAValues(interval, symbol) {
    return await JATB.SMA(interval, symbol)
}

async function getStochasticValues(interval, symbol) {
    return await JATB.Stochastic(interval, symbol)
}

async function getStochasticRSIValues(interval, symbol) {
    return await JATB.StochasticRSI(interval, symbol)
}

async function getTRIXValues(interval, symbol) {
    return await JATB.TRIX(interval, symbol)
}

async function getVWAPValues(interval, symbol) {
    return await JATB.VWAP(interval, symbol)
}

async function getVolumeProfileValues(interval, symbol) {
    return await JATB.VolumeProfile(interval, symbol)
}

async function getEMAValues(interval, symbol) {
    return await JATB.EMA(interval, symbol)
}

async function getWMAValues(interval, symbol) {
    return await JATB.WMA(interval, symbol)
}

async function getWEMAValues(interval, symbol) {
    return await JATB.WEMA(interval, symbol)
}

async function getWilliamsRValues(interval, symbol) {
    return await JATB.WilliamsR(interval, symbol, WR_PERIOD)
}

async function getIchimokuCloudValues(interval, symbol) {
    return await JATB.IchimokuCloud(interval, symbol)
}

async function getSDValues(interval, symbol) {
    return await JATB.SD(interval, symbol)
}

module.exports = {
    strategy: Dummy,
    report: printRankCounters
}
