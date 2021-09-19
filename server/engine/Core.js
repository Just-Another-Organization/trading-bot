'use strict'

const CONFIG_PATH = './Config.json'
let Config = require(CONFIG_PATH)
const botClient = require('./binance-api/BotClient').botClient
const orderManager = require('./binance-api/OrderManager')
const symbolsInfo = require('./binance-api/SymbolsInfo')
const symbolManager = require('./logics/SymbolManager')
const tradesManager = require('./logics/TradesManager')
const candleManager = require('./logics/CandlesManager')
const webhook = require('../webhooks/Webhook')
const Mongoose = require('../mongodb/Connection').Mongoose
const fs = require('fs')
const path = require('path')
const utils = require("./utils/utils");
const {strategy} = require('./strategies/' + Config.STRATEGY)
const ENABLE_INITIAL_ASSETS_CONVERSION = Config.ENABLE_INITIAL_ASSETS_CONVERSION
const SYNCHRONIZED_LOOP = Config.SYNCHRONIZED_LOOP
const MINUTES_FOR_LOOP = Config.MINUTES_FOR_LOOP
const SECONDS_FOR_LOOP = Config.SECONDS_FOR_LOOP
const TRADING_INTERVAL = Config.TRADING_INTERVAL
const BACKTESTING_MODE = Config.BACKTESTING.BACKTESTING_MODE
const BACKTESTING_START_TIMESTAMP = Config.BACKTESTING.START_TIMESTAMP
const LOG_TAG = '\t[JATB-ENGINE]\t|\t'
let TIME_FOR_LOOP = (MINUTES_FOR_LOOP * 60 + SECONDS_FOR_LOOP) * 1000
let lastException = 'NO_UNCAUGHT_ERROR'
const UNPRINTABLE = '**UNPRINTABLE**'
const CLEAN_DATA_ON_EXIT = Config.CLEAN_DATA_ON_EXIT
const CLOSE_TRADE_ON_EXIT = Config.CLOSE_TRADE_ON_EXIT
const STATIC_SYMBOLS_DEFINED = Config.STATIC_SYMBOLS_DEFINED
let symbolsToTrade = null
if (STATIC_SYMBOLS_DEFINED) {
    symbolsToTrade = require('./StaticSymbols.json').StaticSymbols
}

let epoch = 0

async function botInit() {
    console.log('---------->' + LOG_TAG + 'Config: start' + '\t<----------')
    console.time('jatb-execution');

    let config = Object.assign({}, Config);
    config.CREDENTIALS.API_KEY = UNPRINTABLE
    config.CREDENTIALS.API_SECRET = UNPRINTABLE
    console.dir(config)
    console.log('---------->' + LOG_TAG + 'Config: end' + '\t<----------')

    if (!symbolsToTrade) {
        symbolsToTrade = await getSymbolsToTrade()
    }
}

async function loop() {
    console.log('---------->' + LOG_TAG + 'Timeframe: ' + TRADING_INTERVAL + '\t<----------')
    epoch = candleManager.getEpoch()

    if (BACKTESTING_MODE) {
        await saveEpoch(epoch)

        let lastEpoch = candleManager.getLastEpoch()

        if (epoch >= lastEpoch) {
            epoch = 1
            await terminateBacktesting()
        }
    }

    await printTimeInfo()
    await performStrategy()

    candleManager.setEpoch(epoch + 1)

    setTimeout(async () => {
        await loop()
    }, getBotLoopTime(TRADING_INTERVAL))
}

function getBotLoopTime(interval = TRADING_INTERVAL) {
    if (SYNCHRONIZED_LOOP) {
        return utils.getSyncLoopTime(interval)
    } else {
        return TIME_FOR_LOOP
    }
}

async function getSymbolsToTrade() {
    return await symbolManager.getSymbolsByQuoteAsset()
        .then(async (symbolsData) => {
            return symbolsData
        })
        .catch((error) => {
            console.trace(error)
            return {}
        })
}

async function performStrategy() {
    const results = await strategy(symbolsToTrade)
    const tradeToClose = results.tradeToClose
    const tradeToOpen = results.tradeToOpen

    for (let i = 0; i < tradeToClose.length; i++) {
        let trade = tradeToClose[i]
        await tradesManager.sellAsset(trade.symbol, trade.amount)
    }

    for (let i = 0; i < tradeToOpen.length; i++) {
        let trade = tradeToOpen[i]
        await tradesManager.buyAsset(trade.interval, trade.symbol, trade.amount)
    }
}

async function checkApiStatus() {
    console.log(LOG_TAG + 'Binance server reachable: ' + await botClient.ping())
}

async function printTimeInfo() {
    let lastEpoch
    if (BACKTESTING_MODE) {
        lastEpoch = candleManager.getLastEpoch()
    } else {
        lastEpoch = '---'
    }
    let currentDate = Date.now()

    if (BACKTESTING_MODE) {
        const intervalTimestamp = await utils.getTimestampByInterval(TRADING_INTERVAL)
        const currentTimestamp = BACKTESTING_START_TIMESTAMP + (intervalTimestamp * epoch)
        currentDate = new Date(currentTimestamp)
    }

    const formattedDate = getDate(currentDate)
    const formattedTime = getTime(currentDate)

    console.log(LOG_TAG + '[Time]\t' + formattedDate + '\t' + formattedTime + '\t' + 'Epoch: ' + epoch
        + ' / ' + lastEpoch)
}

function getDate(date = Date.now()) {
    return new Date(date).toLocaleDateString('en-US')
}

function getTime(date = Date.now()) {
    return new Date(date).toLocaleTimeString('en-US')
}

async function start() {
    try {
        // TODO set backtesting options in global Config
        /**
         * Backtesting is not set to default, if you want to backtesting before start
         * JATB change "BacktestingEnabled: false" to "BacktestingEnabled: true" in
         * jatb-Config.json
         */
        await checkApiStatus()
        await symbolsInfo.initSymbolsInfo()
            .then(async () => { // TODO: try to remove promise
                console.log(LOG_TAG + 'Symbols info initialization completed')
                if (ENABLE_INITIAL_ASSETS_CONVERSION) {
                    await orderManager.convertTotallyToPrimaryQuoteAsset()
                        .then(async () => {
                            console.log(LOG_TAG + 'All assets converted in primary quote asset')
                        })
                        .catch((error) => {
                            console.trace(error)
                        })
                }
                console.log(LOG_TAG + 'Just Another Trading Bot is ready to go')
                await botInit()
                await loop()
            })
            .catch((error) =>
                console.trace(error)
            )
    } catch (error) {
        console.trace(error)
    }
}

async function saveEpoch(epoch) {
    Config.BACKTESTING.STARTING_EPOCH = epoch
    writeFile(CONFIG_PATH, Config)
}

function writeFile(filepath, data) {
    fs.writeFileSync(path.resolve(__dirname, filepath), JSON.stringify(data, null, 2))
}

async function terminateBacktesting() {
    await closeOpenTrades()

    if (typeof strategy.report !== 'undefined') {
        await strategy.report
    }

    console.log('Backtesting terminated')
    await saveEpoch(epoch)
    console.timeEnd('jatb-execution');
    await new Promise(resolve => setTimeout(resolve, 1440000))
    process.exit(0)
}

async function closeOpenTrades() {
    let tradeToClose = await tradesManager.getOpenTrades()

    for (let i = 0; i < tradeToClose.length; i++) {
        let trade = tradeToClose[i]
        await tradesManager.sellAsset(trade.symbol, trade.amount)
    }
}

process.on('uncaughtException', async function (error) {
    console.log(LOG_TAG + 'Uncaught exception: ' + error)
    if (lastException !== error) {
        await webhook.uncaughtError(error)
    }
    lastException = error
})

process.on('warning', async function (warning) {
    console.log(LOG_TAG + 'Uncaught exception: ' + warning)
    if (lastException !== warning) {
        await webhook.uncaughtWarning(warning)
    }
    lastException = warning
})

function exitHandler() {
    if (CLOSE_TRADE_ON_EXIT) {
        closeOpenTrades()
            .then(() => {
                if (CLEAN_DATA_ON_EXIT) {
                    console.log(LOG_TAG + 'Cleaning database')
                    Mongoose.connection.db.dropDatabase()
                        .then(async () => {
                            console.log(LOG_TAG + 'Database cleaned')
                            console.timeEnd('jatb-execution');
                            process.exit();
                        })
                }
            })
    }
}

process.on('exit', () => {
    exitHandler()
})
process.on('SIGINT', () => {
    exitHandler()
})
process.on('SIGTERM', () => {
    exitHandler()
})
process.on('SIGHUP', () => {
    exitHandler()
})

module.exports = {
    start,
    getTime,
    getDate,
    checkApiStatus,
    getSymbolsToTrade
}
