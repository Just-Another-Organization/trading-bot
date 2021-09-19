'use strict'

const botClient = require('./BotClient').botClient
const axios = require('axios');
const symbolModel = require('../../mongodb/models/Symbol')
const PRICE_FILTER = 'PRICE_FILTER'
const LOT_SIZE = 'LOT_SIZE'
const MIN_NOTIONAL = 'MIN_NOTIONAL'
const Config = require('../Config.json')
const USELESS_SYMBOLS = Config.USELESS_SYMBOLS
const REGEX_PATTERN_TO_AVOID = new RegExp(Config.REGEX_PATTERN_TO_AVOID)
const TRADING_STATUS = 'TRADING'

const MARKET_CAPITALIZATION_ENDPOINT = 'https://www.binance.com/exchange-api/v2/public/asset-service/product/get-products'

let marketCapitalization = []

async function initSymbolsInfo() {
    return new Promise(async (resolve, reject) => { //TODO: try to remove Promise
        let exchangeInfo = await botClient.exchangeInfo()
        let symbolsInfo = exchangeInfo.symbols
        let symbolData = {}
        let filters = {}
        let tickSizePrice = 0
        let stepSizeLot = 0
        let minimumQuantity = 0
        let info
        let isNotUseless
        let isNotToAvoid
        let filter
        let status

        await initMarketCapitalization()

        for (let i = 0; i < symbolsInfo.length; i++) {
            info = symbolsInfo[i]
            status = info.status
            if (status === TRADING_STATUS) {
                isNotUseless = !USELESS_SYMBOLS.includes(info.symbol)
                isNotToAvoid = !REGEX_PATTERN_TO_AVOID.test(info.symbol)
                if (isNotUseless && isNotToAvoid) {
                    filters = info.filters
                    for (let j = 0; j < filters.length; j++) {
                        filter = filters[j]
                        switch (filter.filterType) {
                            case PRICE_FILTER:
                                tickSizePrice = filter.tickSize
                                break
                            case LOT_SIZE:
                                stepSizeLot = filter.stepSize
                                break
                            case MIN_NOTIONAL:
                                minimumQuantity = filter.minNotional
                                break
                        }
                    }
                    symbolData = {
                        symbol: info.symbol,
                        baseAsset: info.baseAsset,
                        quoteAsset: info.quoteAsset,
                        tickSizePrice: tickSizePrice,
                        stepSizeLot: stepSizeLot,
                        sensibilityDigits: await getSensibilityDigits(stepSizeLot),
                        minimumQuantity: minimumQuantity,
                        timeToStartIgnore: null,
                        timeToIgnore: null,
                        marketCap: getSymbolCapitalization(info.symbol),
                        strategiesUtils: null
                    }
                    await symbolModel.saveSymbol(symbolData)
                        .then((status) => {
                            return status
                        })
                        .catch((error) => {
                            // Suppressing duplicate data errors. TODO: remove this suppress and manage the errors
                            if (!Number.isInteger(error)) {
                                console.trace(error)
                            }
                        })
                }
            }
        }
        resolve(true)
    })
}

async function initMarketCapitalization() {
    marketCapitalization = []
    await axios.get(MARKET_CAPITALIZATION_ENDPOINT)
        .then((response) => {
            const symbolsCapitalization = response.data.data
            for (const symbolData of symbolsCapitalization) {
                const symbol = symbolData.s
                const marketCap = symbolData.cs * parseFloat(symbolData.c)

                const symbolCap = {
                    symbol: symbol,
                    marketCap: marketCap
                }
                marketCapitalization.push(symbolCap)
            }
        })
        .catch(error => {
            console.trace(error);
        });
}

function getSymbolCapitalization(symbol) {
    for (const symbolCap of marketCapitalization) {
        if (symbolCap.symbol === symbol) {
            return symbolCap.marketCap
        }
    }
    return 0
}

async function getSensibilityDigits(stepSizeLot) {
    let decimalSensibility = false
    for (let i = 0; i < stepSizeLot.length; i++) {
        if (stepSizeLot.charAt(i) === '.') {
            decimalSensibility = true
        } else if (stepSizeLot.charAt(i) === '1') {
            if (decimalSensibility) {
                i = (i - 1) * (-1)
            } else {
                while (stepSizeLot.charAt(i) === '.') {
                    i++
                }
                i++
            }
            return i
        }
    }
    return null
}

module.exports = {
    initSymbolsInfo
}
