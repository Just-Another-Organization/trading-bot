'use strict'

const tradeModel = require('../../mongodb/models/Trade')
const orderManager = require('../binance-api/OrderManager')
const candleManager = require('./CandlesManager')
const Config = require('../Config.json')
const webhook = require('../../webhooks/Webhook')
const STOPLOSS_PERCENTAGE_LIMIT = Config.STOP_LOSS_TAKE_PROFIT.STOPLOSS_PERCENTAGE_LIMIT
const TAKEPROFIT_PERCENTAGE_LIMIT = Config.STOP_LOSS_TAKE_PROFIT.TAKEPROFIT_PERCENTAGE_LIMIT
const MAX_AMOUNT = orderManager.MAX_AMOUNT
const BACKTESTING_MODE = Config.BACKTESTING.BACKTESTING_MODE
const TRADE_MANAGEMENT = Config.MULTI_TRADE.TRADE_MANAGEMENT
const QUOTE_ASSET = Config.PRIMARY_QUOTE_ASSET
const SINGLE_TRADE_MODE = Config.SINGLE_TRADE_MODE
const MULTI_TRADE_MODE = Config.MULTI_TRADE.MULTI_TRADE_MODE
const CAPITAL = Config.BACKTESTING.CAPITAL
const CAPITAL_TO_USE_PERCENTAGE = Config.CAPITAL_TO_USE_PERCENTAGE

let backtestingCapital = CAPITAL

async function getTrade(symbol) {
    return await tradeModel.getTradeData(symbol)
        .then(async (data) => {
            return data
        })
        .catch((error) => {
            console.trace(error)
            return null
        })
}

async function evaluateTradeRewardBySymbol(symbol) {
    const trade = await getTrade(symbol)
    return await evaluateTradeReward(trade)
}

async function evaluateTradeReward(trade) {
    let percentageProfit
    let actualPrice = await candleManager.getLastPrice(trade.symbol)
    let reward = calculateRewardGap(trade.amount, actualPrice, trade.entryPrice)
    await setReward(trade.symbol, reward)
    percentageProfit = (1 / trade.amount) * (reward * 100)

    return {
        reward,
        percentageProfit
    }
}

async function evaluateOpenTradesReward() {
    let trades = await getOpenedTrades()
    for (let i = 0; i < trades.length; i++) {
        await evaluateTradeReward(trades[i])
    }
}

function calculateRewardGap(amount, actualPrice, entryPrice) {
    if (amount !== 0) {
        return (actualPrice - entryPrice) * (amount / entryPrice)
    } else {
        console.log('No amount specified: setted to 100')
        return (actualPrice - entryPrice) * (100 / entryPrice)
    }
}

async function setReward(symbol, reward) {
    await tradeModel.setReward(symbol, reward)
        .then(() => {
        })
        .catch((error) => {
            console.trace(error)
        })
}

async function isTradeStored(symbol) {
    return await tradeModel.isTradeOfDB(symbol)
        .then((status) => {
            return status
        })
        .catch((error) => {
            return false
        })
}

async function buyAsset(interval, symbol, amount = null) {
    // First of all place the new order to minimize price oscillations
    // console.log('Open ' + symbol)
    const openableTrades = await getOpenableTradesNumber()
    if (openableTrades <= 0) {
        return false
    }

    if (!amount) {
        amount = await getManagedAmount()
    }
    return await orderManager.buyAsset(symbol, amount)
        .then(async (bought) => {
            if (bought) {
                const tradeData = {
                    symbol: symbol,
                    interval: interval,
                    entryPrice: await candleManager.getLastPrice(symbol),
                    amount: amount,
                    reward: 0.0,
                    stopLossPercentage: STOPLOSS_PERCENTAGE_LIMIT,
                    takeProfitPercentage: TAKEPROFIT_PERCENTAGE_LIMIT
                }
                await webhook.openTrade(tradeData)
                return await saveTrade(tradeData)
            }
            return false
        })
        .catch((error) => {
            console.trace(error)
            return false
        })
}

async function getManagedAmount() {
    const openedTrade = await getOpenedTradesNumber()
    const tradePercentageCapital = (TRADE_MANAGEMENT[openedTrade]) / 100

    let amount = 0
    if (BACKTESTING_MODE) {
        if (SINGLE_TRADE_MODE) {
            amount = backtestingCapital
        } else {
            if (MULTI_TRADE_MODE) {
                amount = backtestingCapital * tradePercentageCapital
            }
        }
    } else {
        const availableCapital = await orderManager.getClientCoinBalance(QUOTE_ASSET)

        if (SINGLE_TRADE_MODE) {
            amount = availableCapital * CAPITAL_TO_USE_PERCENTAGE / 100
        } else {
            if (MULTI_TRADE_MODE) {
                let residualCapitalPercentage = 100
                for (let i = 0; i < openedTrade; i++) {
                    residualCapitalPercentage -= TRADE_MANAGEMENT[i]
                }
                const adjustedPercentage = tradePercentageCapital * 100 / residualCapitalPercentage

                amount = availableCapital * adjustedPercentage
            }
        }
    }

    return amount
}

async function getOpenableTradesNumber() {
    const openTrades = await getOpenedTrades()
    if (SINGLE_TRADE_MODE) {
        if (openTrades >= 1) {
            return 0
        } else {
            return 1
        }
    }
    if (MULTI_TRADE_MODE) {
        return TRADE_MANAGEMENT.length - openTrades.length
    }
}

async function getOpenedTradesNumber() {
    const openTrades = await getOpenedTrades()
    return openTrades.length
}

async function saveTrade(tradeData) {
    return await tradeModel.saveTrade({tradeData})
        .then((status) => {
            return status
        })
        .catch((error) => {
            console.trace(error)
            return error
        })
}

async function sellAsset(symbol, amount = MAX_AMOUNT) {
    // First of all place the new order to minimize price oscillations
    // console.log('Selling ' + symbol)
    return await orderManager.sellAsset(symbol, amount)
        .then(async (sold) => {
            if (sold) {
                const tradeReward = await evaluateTradeRewardBySymbol(symbol)
                const trade = await getTrade(symbol)
                await webhook.closeTrade(trade)

                console.log('Reward:\t' + tradeReward.reward)
                console.log('Profit:\t' + tradeReward.percentageProfit)

                return await deleteTrade(symbol)
            }
            return false
        })
        .catch((error) => {
            console.trace(error)
            return false
        })
}

async function deleteTrade(symbol) {
    return await tradeModel.deleteOne(symbol)
        .then((status, error) => {
            if (error) {
                console.trace(error)
                return error
            }
            return status
        })
        .catch((error) => {
            console.trace(error)
        })
}

async function getOpenedTrades() {
    let openTradesSymbols = []
    await getOpenTrades()
        .then((openTrades) => {
            for (let i = 0; i < openTrades.length; i++) {
                openTradesSymbols.push(openTrades[i])
            }
        })
        .catch((error) => {
            console.trace(error)
        })

    return openTradesSymbols
}

async function getOpenTrades() {
    return await tradeModel.getAllTradeData()
        .then((allTradeData) => {
            return allTradeData
        })
        .catch((error) => {
            console.trace(error)
            return null
        })
}

async function setStopLoss(symbol, stopLossPercentage) {
    return await tradeModel.setStopLoss(symbol, stopLossPercentage)
        .then((status, error) => {
            if (error) {
                console.trace(error)
                return error
            }
            return status
        })
        .catch((error) => {
            console.trace(error)
        })
}

async function setTakeProfit(symbol, takeProfitPercentage) {
    return await tradeModel.setTakeProfit(symbol, takeProfitPercentage)
        .then((status, error) => {
            if (error) {
                console.trace(error)
                return error
            }
            return status
        })
        .catch((error) => {
            console.trace(error)
        })
}

module.exports = {
    getTrade,
    evaluateOpenTradesReward,
    buyAsset,
    sellAsset,
    getOpenedTrades,
    getOpenTrades,
    setStopLoss,
    setTakeProfit,
    getOpenableTradesNumber,
    getOpenedTradesNumber,
    isTradeStored
}
