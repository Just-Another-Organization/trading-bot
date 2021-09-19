'use strict'

const tradesManager = require('../logics/TradesManager')
const candlesManager = require('../logics/CandlesManager')
const Config = require('../Config.json')
const SPECIFIC_CONFIG = Config.STOP_LOSS_TAKE_PROFIT
const STOPLOSS_PERCENTAGE_LIMIT = SPECIFIC_CONFIG.STOPLOSS_PERCENTAGE_LIMIT
const TAKEPROFIT_PERCENTAGE_LIMIT = SPECIFIC_CONFIG.TAKEPROFIT_PERCENTAGE_LIMIT
const STOPLOSS_UPDATE_STEP = SPECIFIC_CONFIG.STOPLOSS_UPDATE_STEP
const TAKEPROFIT_UPDATE_STEP = SPECIFIC_CONFIG.TAKEPROFIT_UPDATE_STEP
const DYNAMIC_STOPLOSS_TAKEPROFIT = SPECIFIC_CONFIG.DYNAMIC_STOPLOSS_TAKEPROFIT
const DYNAMIC_SENSIBILITY = SPECIFIC_CONFIG.DYNAMIC_SENSIBILITY
const TRAILING_STOPLOSS_TAKEPROFIT = SPECIFIC_CONFIG.TRAILING_STOPLOSS_TAKEPROFIT
const {MAX_AMOUNT} = require('../binance-api/OrderManager')
const LOG_TAG = '\t[TAKE/STOP]\t|\t'

// TODO: merge correlated methods

async function takeProfit (symbol) {
    let tradeData = await tradesManager.getTrade(symbol)
    let percentageProfit = ((await candlesManager.getLastPrice(symbol) - tradeData.entryPrice) / tradeData.entryPrice) * 100
    return percentageProfit > tradeData.takeProfitPercentage
}

async function stopLoss (symbol) {
    let tradeData = await tradesManager.getTrade(symbol)
    let percentageLoss = ((await candlesManager.getLastPrice(symbol) - tradeData.entryPrice) / tradeData.entryPrice) * 100
    return percentageLoss < tradeData.stopLossPercentage
}

async function evaluateClassicTakeProfit (symbol, amount = MAX_AMOUNT) {
    let tradeExist = (await tradesManager.getTrade(symbol) !== null)
    if (tradeExist) {
        let takeProfitTriggered = await takeProfit(symbol)
        if (takeProfitTriggered) {
            return await tradesManager.sellAsset(symbol, amount)
        }
        return false
    }
}

async function evaluateClassicStopLoss (symbol, amount = MAX_AMOUNT) {
    let tradeExist = (await tradesManager.getTrade(symbol) !== null)
    if (tradeExist) {
        let stopLossTriggered = await stopLoss(symbol)
        if (stopLossTriggered) {
            return await tradesManager.sellAsset(symbol, amount)
        }
        return false
    }
}

async function evaluateClassicStopLossAndTakeProfit (symbol, amount = MAX_AMOUNT) {
    let tradeExist = (await tradesManager.getTrade(symbol) !== null)
    if (tradeExist) {
        let takeProfitTriggered = await takeProfit(symbol)
        let stopLossTriggered = await stopLoss(symbol)
        if (takeProfitTriggered || stopLossTriggered) {
            return await tradesManager.sellAsset(symbol, amount)
        }
    }
    return false
}

async function dynamicTakeProfit (symbol, percentageLimit) {
    let tradeData = await tradesManager.getTrade(symbol)
    let percentageProfit = ((await candlesManager.getLastPrice(symbol) - tradeData.entryPrice) / tradeData.entryPrice) * 100
    return percentageProfit > percentageLimit
}

async function dynamicStopLoss (symbol) {
    let tradeData = await tradesManager.getTrade(symbol)
    let gain = ((await candlesManager.getLastPrice(symbol) - tradeData.entryPrice) / tradeData.entryPrice) * 100
    console.log('Gain: \t' + gain)
    if (gain > tradeData.stopLossPercentage) {
        let delta = gain - tradeData.stopLossPercentage
        if ((delta + DYNAMIC_SENSIBILITY - Math.abs(STOPLOSS_PERCENTAGE_LIMIT)) / Math.abs(STOPLOSS_PERCENTAGE_LIMIT) > 1) {
            let newStopLossLevel = tradeData.stopLossPercentage + (delta * STOPLOSS_UPDATE_STEP)
            await tradesManager.setStopLoss(symbol, newStopLossLevel)
            console.log(LOG_TAG + 'Updated stop loss: ' + newStopLossLevel)
        }
        return false
    }
    return true
}

async function evaluateDynamicTakeProfit (symbol, amount = MAX_AMOUNT) {
    let tradeExist = (await tradesManager.getTrade(symbol) !== null)
    if (tradeExist) {
        let takeProfitTriggered = await dynamicTakeProfit(symbol)
        if (takeProfitTriggered) {
            return await tradesManager.sellAsset(symbol, amount)
        }
        return false
    }
}

async function evaluateDynamicStopLoss (symbol, amount = MAX_AMOUNT) {
    let tradeExist = (await tradesManager.getTrade(symbol) !== null)
    if (tradeExist) {
        let stopLossTriggered = await dynamicStopLoss(symbol)
        if (stopLossTriggered) {
            return await tradesManager.sellAsset(symbol, amount)
        }
        return false
    }
}

async function evaluateTrailingStopLoss (symbol, amount = MAX_AMOUNT) {
    let tradeExist = (await tradesManager.getTrade(symbol) !== null)
    if (tradeExist) {
        let stopLossTriggered = await trailingStopLoss(symbol)
        if (stopLossTriggered) {
            return await tradesManager.sellAsset(symbol, amount)
        }
        return false
    }
}

async function trailingStopLoss (symbol) {
    let tradeData = await tradesManager.getTrade(symbol)
    let lastPrice = await candlesManager.getLastPrice(symbol)
    let gain = ((lastPrice - tradeData.entryPrice) / tradeData.entryPrice) * 100
    console.log('Gain: \t' + gain)
    if (gain > tradeData.stopLossPercentage) {
        let delta = gain - tradeData.stopLossPercentage
        // if (delta + DYNAMIC_SENSIBILITY > Math.abs(STOPLOSS_PERCENTAGE_LIMIT)) {
        if ((delta + DYNAMIC_SENSIBILITY - Math.abs(STOPLOSS_PERCENTAGE_LIMIT)) / Math.abs(STOPLOSS_PERCENTAGE_LIMIT) > 1) {
            let newStopLossLevel = gain - Math.abs(STOPLOSS_PERCENTAGE_LIMIT)
            await tradesManager.setStopLoss(symbol, newStopLossLevel)
            console.log(LOG_TAG + 'Updated stop loss: ' + newStopLossLevel)
        }

        return false
    }
    return true
}

async function evaluateStopLoss (symbol, amount) {
    if (TRAILING_STOPLOSS_TAKEPROFIT) {
        return evaluateTrailingStopLoss(symbol, amount)
    }
    if (DYNAMIC_STOPLOSS_TAKEPROFIT) {
        return evaluateDynamicStopLoss(symbol, amount)
    } else {
        return evaluateClassicStopLoss(symbol, amount)
    }
}

async function evaluateTakeProfit (symbol, amount) {
    if (DYNAMIC_STOPLOSS_TAKEPROFIT) {
        return evaluateDynamicTakeProfit(symbol, amount)
    } else {
        return evaluateClassicTakeProfit(symbol, amount)
    }
}

async function evaluateDynamicStopLossAndTakeProfit (symbol, amount) {
    // TODO
    return false
}

async function evaluateStopLossAndTakeProfit (symbol, amount) {
    if (DYNAMIC_STOPLOSS_TAKEPROFIT) {
        return evaluateDynamicStopLossAndTakeProfit(symbol, amount)
    } else {
        return evaluateClassicStopLossAndTakeProfit(symbol, amount)
    }
}

module.exports = {
    takeProfit,
    stopLoss,
    evaluateStopLoss,
    evaluateTakeProfit,
    evaluateStopLossAndTakeProfit
}
