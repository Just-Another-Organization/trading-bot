'use strict'

const botClient = require('./BotClient').botClient
const candlesManager = require('../logics/CandlesManager')
const symbolModel = require('../../mongodb/models/Symbol')
const Config = require('../Config.json')
const BUY_SIDE = 'BUY'
const SELL_SIDE = 'SELL'
const LIMIT_ORDER_TYPE = 'LIMIT'
const MARKET_ORDER_TYPE = 'MARKET'
const MAX_AMOUNT = 'MAX_AMOUNT'
const FEES_PERCENTAGE = Config.FEES_PERCENTAGE
const ORDER_TYPE = Config.MARKET_TYPE ? MARKET_ORDER_TYPE : LIMIT_ORDER_TYPE
const PRIMARY_QUOTE_ASSET = Config.PRIMARY_QUOTE_ASSET
const SECONDARY_QUOTE_ASSET = Config.SECONDARY_QUOTE_ASSET
const BACKTESTING_MODE = Config.BACKTESTING.BACKTESTING_MODE
const LOG_TAG = '\t[ORDER-MANAGER]\t|\t'

async function buyAsset (symbol, amount) {
    if (BACKTESTING_MODE) {
        return true
    }
    return await symbolModel.getSymbolData(symbol)
        .then(async (symbolData) => {
            let price = await candlesManager.getLastPrice(symbol)
            let quantity = await getQuantityToBuy(symbolData, amount, price)
            if (quantity) {
                let enoughBalance = await checkBuyBalance(symbolData, quantity, price)
                if (enoughBalance) {
                    return await buy(symbol, quantity)
                }
            }
            return false
        })
        .catch((error) => {
            console.trace(error)
            return false
        })
}

async function buy(symbol, quantity) {
    // TODO: Create a test case using 'orderTest'
    // use 'orderTest' to test order without real oder processing
    return botClient.order({
        symbol: symbol,
        side: BUY_SIDE,
        quantity: quantity,
        type: ORDER_TYPE
    })
        .then((data) => {
            console.log(LOG_TAG + 'Order executed:')
            console.log(data)
            return true
        })
        .catch((error) => {
            console.trace(error)
            return false
        })
}

async function getQuantityToBuy (symbolData, amount, price) {
    let quantity = await calculateQuantityToBuy(symbolData, amount, price)

    if ((quantity > symbolData.stepSizeLot) && (quantity * price > symbolData.minimumQuantity)) {
        return quantity
    }
    return null
}

async function calculateQuantityToBuy (symbolData, amount, price) {
    let sensibilityDigits = symbolData.sensibilityDigits
    let coinToSell = symbolData.quoteAsset
    let rawQuantity
    if (amount === MAX_AMOUNT) {
        let quantity = await getClientCoinBalance(coinToSell) / price
        return await removeFees(quantity)
    } else {
        rawQuantity = amount / price
    }

    return await adjustQuantity(rawQuantity, sensibilityDigits)
}

async function sellAsset (symbol, amount) {
    if (BACKTESTING_MODE) {
        return true
    }
    return await symbolModel.getSymbolData(symbol)
        .then(async (symbolData) => {
            let price = await candlesManager.getLastPrice(symbol)
            let quantity = await getQuantityToSell(symbolData, amount, price)
            if (quantity) {
                let enoughBalance = await checkSellBalance(symbolData, quantity)
                if (enoughBalance) {
                    return await sell(symbol, quantity)
                }
            }
            return false
        })
        .catch((error) => {
            console.trace(error)
            return false
        })
}

async function sell(symbol, quantity) {
    // TODO: Create a test case using 'orderTest'
    // use 'orderTest' to test order without real oder processing
    return botClient.order({
        symbol: symbol,
        side: SELL_SIDE,
        quantity: quantity,
        type: ORDER_TYPE
    })
        .then((data) => {
            console.log(LOG_TAG + 'Order executed:')
            console.log(data)
            return true
        })
        .catch((error) => {
            console.trace(error)
            return false
        })
}

async function getQuantityToSell (symbolData, amount, price) {
    let quantity = await calculateQuantityToSell(symbolData, amount, price)

    if ((quantity > symbolData.stepSizeLot) && (quantity * price > symbolData.minimumQuantity)) {
        return quantity
    }
    return null
}

async function calculateQuantityToSell (symbolData, amount, price) {
    let sensibilityDigits = symbolData.sensibilityDigits
    let coinToBuy = symbolData.baseAsset
    let rawQuantity
    if (amount === MAX_AMOUNT) {
        rawQuantity = await getClientCoinBalance(coinToBuy)
    } else {
        rawQuantity = amount / price
    }
    return await adjustQuantity(rawQuantity, sensibilityDigits)
}

async function adjustQuantity (quantity, sensibilityDigits) {
    let adjustment = 5 // Tested: 5, 10 --> Too much order failed - 50 --> Too much money
    if (sensibilityDigits > 0) {
        for (let i = 0; i < sensibilityDigits; i++) {
            adjustment = adjustment * 10
        }
        quantity = quantity - adjustment
        for (let i = 0; i < sensibilityDigits; i++) {
            quantity = quantity / 10
        }
        quantity = Math.trunc(quantity)
        for (let i = 0; i < sensibilityDigits; i++) {
            quantity = quantity * 10
        }
    } else {
        sensibilityDigits = sensibilityDigits * (-1)
        for (let i = 0; i < sensibilityDigits; i++) {
            adjustment = adjustment / 10
        }

        // Round off due to max decimal size of Binance input
        return parseFloat((quantity - adjustment).toFixed(sensibilityDigits))
    }
}

async function removeFees (quantity) {
    return quantity - (quantity * FEES_PERCENTAGE / 100)
}

async function getClientCoinBalance (coin) {
    let balances = (await botClient.accountInfo()).balances
    for (let i = 0; i < balances.length; i++) {
        if (balances[i].asset === coin) {
            return parseFloat(balances[i].free)
        }
    }
    return null
}

async function convertToPrimaryQuoteAsset (coin) {
    if (coin !== PRIMARY_QUOTE_ASSET) {
        let symbol = coin.concat(PRIMARY_QUOTE_ASSET)
        await sellAsset(symbol, MAX_AMOUNT)
    }
}

async function convertToSecondaryQuoteAsset (coin) {
    if (coin !== SECONDARY_QUOTE_ASSET) {
        let symbol = coin.concat(SECONDARY_QUOTE_ASSET)
        await sellAsset(symbol, MAX_AMOUNT)
    }
}

async function convertTotallyToPrimaryQuoteAsset () {
    return new Promise(async (resolve, reject) => {
        let balances = (await botClient.accountInfo()).balances
        let coinToPrimaryQuoteAssetExist = false
        let coinToSecondaryQuoteAssetExist = false
        for (let i = 0; i < balances.length; i++) {
            if (balances[i].free > 0 && balances[i].asset !== PRIMARY_QUOTE_ASSET) {
                coinToPrimaryQuoteAssetExist = await symbolModel.isSymbolOfDB(balances[i].asset.concat(PRIMARY_QUOTE_ASSET))
                console.log(LOG_TAG + 'Converting to quote asset:\t' + balances[i].asset)
                if (coinToPrimaryQuoteAssetExist === true) {
                    await convertToPrimaryQuoteAsset(balances[i].asset)
                } else {
                    coinToSecondaryQuoteAssetExist = await symbolModel.isSymbolOfDB(balances[i].asset.concat(SECONDARY_QUOTE_ASSET))
                    if (coinToSecondaryQuoteAssetExist === true) {
                        await convertToSecondaryQuoteAsset(balances[i].asset)
                    } else {
                        console.log(LOG_TAG + 'No quote assets possible conversion:\t' + balances[i].asset)
                    }
                }
            }
        }
        await convertToPrimaryQuoteAsset(SECONDARY_QUOTE_ASSET)
        resolve(true)
    })
}

async function checkBuyBalance (symbolData, quantity, price) {
    let coin = symbolData.quoteAsset
    let balance = await getClientCoinBalance(coin)
    if (balance > quantity * price) {
        return true
    } else {
        return await tryToGetBalance(coin, quantity)
    }
}

async function checkSellBalance (symbolData, quantity) {
    let coin = symbolData.baseAsset
    let balance = await getClientCoinBalance(coin)
    return quantity < balance
}

async function tryToGetBalance (coin, quantity) {
    if (coin === PRIMARY_QUOTE_ASSET) {
        return false
    }
    return symbolModel.isSymbolOfDB(coin.concat(PRIMARY_QUOTE_ASSET))
        .then(async (existUSDTPair) => {
            if (existUSDTPair) {
                return await buyAsset(coin.concat(PRIMARY_QUOTE_ASSET), quantity)
            } else {
                return symbolModel.isSymbolOfDB(coin.concat(SECONDARY_QUOTE_ASSET))
                    .then(async (existBTCPair) => {
                        if (existBTCPair) {
                            return await buyAsset(coin.concat(SECONDARY_QUOTE_ASSET), quantity)
                        }
                        return false
                    })
                    .catch((error) => {
                        console.trace(error)
                    })
            }
        })
        .catch((error) => {
            console.trace(error)
        })
}

async function marginSell (symbol, quantity) {
    return botClient.marginOrder({
        symbol: symbol,
        side: SELL_SIDE,
        quantity: quantity,
        type: ORDER_TYPE
    })
        .then((data) => {
            console.log(LOG_TAG + 'Order executed:')
            console.log(data)
            return true
        })
        .catch((error) => {
            console.trace(error)
            return false
        })
}

module.exports = {
    BUY_SIDE,
    SELL_SIDE,
    MAX_AMOUNT,
    PRIMARY_QUOTE_ASSET,
    SECONDARY_QUOTE_ASSET,
    getClientCoinBalance,
    convertTotallyToPrimaryQuoteAsset,
    buyAsset,
    sellAsset,
    marginSell
}
