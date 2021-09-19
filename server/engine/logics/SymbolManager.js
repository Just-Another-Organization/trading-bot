'use strict'

const symbolModel = require('../../mongodb/models/Symbol')
const orderManager = require('../binance-api/OrderManager')
const Config = require('../Config.json')
const trend = require('../logics/Trend')

const TRADING_INTERVAL = Config.TRADING_INTERVAL
const PRIMARY_QUOTE_ASSET = Config.PRIMARY_QUOTE_ASSET
const TRADING_TERM = Config.TRADING_TERM
let TRADING_TIMEFRAME
if (TRADING_TERM.LONG_TERM) {
    TRADING_TIMEFRAME = trend.LONG_TERM
} else if (TRADING_TERM.MID_TERM) {
    TRADING_TIMEFRAME = trend.MID_TERM
} else {
    TRADING_TIMEFRAME = trend.SHORT_TERM
}

const SORT_BY_MARKET_CAP = Config.SORT_BY_MARKET_CAP

async function getSymbolQuoteAmount(symbol) {
    return await symbolModel.getSymbolData(symbol)
        .then(async (symbolData) => {
            return await orderManager.getClientCoinBalance(symbolData.quoteAsset)
        })
        .catch((error) => {
            console.trace(error)
        })
}

async function setTimeToIgnore (symbol, time) {
    if (Config.BACKTESTING.BACKTESTING_MODE) {
        return true
    }
    return await symbolModel.setTimeToIgnore(symbol, time)
        .then(async (status) => {
            return status
        })
        .catch((error) => {
            console.trace(error)
        })
}

async function getSymbolsByQuoteAsset () {
    return symbolModel.getSymbolsDataByQuoteAsset(PRIMARY_QUOTE_ASSET)
        .then((symbolsData) => {
            let SymbolsToTrade = []

            if (SORT_BY_MARKET_CAP) {
                symbolsData = sortSymbolByMarketCap(symbolsData)
            }
            for (let i = 0; i < symbolsData.length; i++) {
                let symbolObj = {
                    'interval': TRADING_INTERVAL,
                    'symbol': '',
                    'timeframe': TRADING_TIMEFRAME
                }
                symbolObj.symbol = symbolsData[i].symbol
                SymbolsToTrade.push(symbolObj)
            }
            return SymbolsToTrade
        })
        .catch((error) => {
            console.trace(error)
            return []
        })
}

function sortSymbolByMarketCap(symbolData) {
    return symbolData.sort((a, b) => {
        return (a.marketCap < b.marketCap) ? 1 : ((b.marketCap < a.marketCap) ? -1 : 0)
    })
}

async function removeSymbolsToIgnore(SymbolsToTrade) {
    let symbol = ''
    for (let i = 0; i < SymbolsToTrade.length; i++) {
        symbol = SymbolsToTrade[i].symbol
        await symbolModel.isSymbolToIgnore(symbol)
            .then((isSymbolToIgnore) => {
                if (isSymbolToIgnore) {
                    SymbolsToTrade.splice(i, 1)
                }
            })
            .catch((error) => {
                console.trace(error)
            })
    }
    return SymbolsToTrade
}

async function cleanTimeToIgnore (symbol) {
    return await symbolModel.cleanTimeToIgnore(symbol)
        .then(async (status) => {
            return status
        })
        .catch((error) => {
            console.trace(error)
        })
}

async function setStrategyUtils (symbol, strategyName, utilsObject) {
    return await symbolModel.setStrategyUtils(symbol, strategyName, utilsObject)
        .then(async (status) => {
            return status
        })
        .catch((error) => {
            console.trace(error)
        })
}

async function getStrategyUtils (symbol, strategyName) {
    return await symbolModel.getStrategyUtils(symbol, strategyName)
        .then(async (utilsObject) => {
            return utilsObject
        })
        .catch((error) => {
            console.trace(error)
        })
}

module.exports = {
    getSymbolQuoteAmount,
    setTimeToIgnore,
    getSymbolsByQuoteAsset,
    removeSymbolsToIgnore,
    cleanTimeToIgnore,
    setStrategyUtils,
    getStrategyUtils
}
