'use strict'

const symbolLogic = require('./logics/SymbolLogic')
const tradesManager = require('./logics/TradesManager')
const candlesManager = require('./logics/CandlesManager')
const symbolManager = require('./logics/SymbolManager')
const trend = require('./logics/Trend')
const orderManager = require('./binance-api/OrderManager')
const Config = require('./Config.json')

exports.UPTREND_DIRECTION = symbolLogic.UPTREND_DIRECTION
exports.DOWNTREND_DIRECTION = symbolLogic.DOWNTREND_DIRECTION
exports.BOTH_TREND_DIRECTION = symbolLogic.BOTH_TREND_DIRECTION
exports.FloorPivot = symbolLogic.FloorPivot
exports.FibonacciPivot = symbolLogic.FibonacciPivot
exports.LONG_TERM = trend.LONG_TERM
exports.MID_TERM = trend.MID_TERM
exports.SHORT_TERM = trend.SHORT_TERM
exports.isUptrend = trend.isUptrend
exports.getTrendIntensity = trend.getTrendIntensity
exports.sortSymbolsByTrend = trend.sortSymbolsByTrend
exports.isSMAUptrend = trend.isSMAUptrend
exports.isEMAUptrend = trend.isEMAUptrend
exports.isSMACrossUptrend = trend.isSMACrossUptrend
exports.isEMACrossUptrend = trend.isEMACrossUptrend
exports.isMAStatusUptrend = trend.isMAStatusUptrend
exports.ADL = symbolLogic.ADL
exports.ADX = symbolLogic.ADX
exports.ATR = symbolLogic.ATR
exports.AwesomeOscillator = symbolLogic.AwesomeOscillator
exports.BollingerBands = symbolLogic.BollingerBands
exports.CCI = symbolLogic.CCI
exports.ForceIndex = symbolLogic.ForceIndex
exports.KST = symbolLogic.KST
exports.MFI = symbolLogic.MFI
exports.MACD = symbolLogic.MACD
exports.OBV = symbolLogic.OBV
exports.PSAR = symbolLogic.PSAR
exports.ROC = symbolLogic.ROC
exports.RSI = symbolLogic.RSI
exports.SMA = symbolLogic.SMA
exports.Stochastic = symbolLogic.Stochastic
exports.StochasticRSI = symbolLogic.StochasticRSI
exports.TRIX = symbolLogic.TRIX
exports.TypicalPrices = symbolLogic.TypicalPrices
exports.VWAP = symbolLogic.VWAP
exports.VolumeProfile = symbolLogic.VolumeProfile
exports.EMA = symbolLogic.EMA
exports.WMA = symbolLogic.WMA
exports.WEMA = symbolLogic.WEMA
exports.WilliamsR = symbolLogic.WilliamsR
exports.IchimokuCloud = symbolLogic.IchimokuCloud
exports.ChandelierExitStatus = symbolLogic.ChandelierExitStatus
exports.ChandelierValue = symbolLogic.ChandelierValue
exports.HigherHigh = symbolLogic.HigherHigh
exports.LowerLow = symbolLogic.LowerLow
exports.CrossUp = symbolLogic.CrossUp
exports.CrossDown = symbolLogic.CrossDown
exports.CrossOver = symbolLogic.CrossOver
exports.SD = symbolLogic.SD
exports.getOnceTypicalPrice = symbolLogic.getOnceTypicalPrice
exports.isBullish = symbolLogic.isBullish
exports.isBearish = symbolLogic.isBearish

exports.Momentum = symbolLogic.Momentum
exports.TSI = symbolLogic.TSI

exports.takeProfit = symbolLogic.takeProfit
exports.stopLoss = symbolLogic.stopLoss
exports.evaluateStopLoss = symbolLogic.evaluateStopLoss
exports.evaluateTakeProfit = symbolLogic.evaluateTakeProfit
exports.evaluateStopLossAndTakeProfit = symbolLogic.evaluateStopLossAndTakeProfit

// Trades Manager Exports
exports.getTrade = tradesManager.getTrade
exports.evaluateOpenTradesReward = tradesManager.evaluateOpenTradesReward
exports.openTrade = tradesManager.buyAsset
exports.closeTrade = tradesManager.sellAsset
exports.getOpenedTrades = tradesManager.getOpenedTrades
exports.getOpenTrades = tradesManager.getOpenTrades
exports.setStopLoss = tradesManager.setStopLoss
exports.setTakeProfit = tradesManager.setTakeProfit
exports.getOpenableTradesNumber = tradesManager.getOpenableTradesNumber
exports.getOpenedTradesNumber = tradesManager.getOpenedTradesNumber
exports.isTradeStored = tradesManager.isTradeStored

// Condles Manager Exports
exports.getCandlesBySymbol = candlesManager.getCandlesBySymbol
exports.isTimeToUpdate = candlesManager.isTimeToUpdate
exports.isTimeToUpdateCandle = candlesManager.isTimeToUpdateCandle
exports.requestHistoricalCandlesData = candlesManager.requestHistoricalCandlesData
exports.getCandleHistoricalData = candlesManager.getCandleHistoricalData
exports.addCandleHistoricalData = candlesManager.addCandleHistoricalData
exports.getLastPrice = candlesManager.getLastPrice
exports.getLastCandle = candlesManager.getLastCandle

// Symbol Manager Exports
exports.getSymbolQuoteAmount = symbolManager.getSymbolQuoteAmount
exports.setTimeToIgnore = symbolManager.setTimeToIgnore
exports.getUSDTSymbols = symbolManager.getSymbolsByQuoteAsset
exports.removeSymbolsToIgnore = symbolManager.removeSymbolsToIgnore
exports.cleanTimeToIgnore = symbolManager.cleanTimeToIgnore
exports.setStrategyUtils = symbolManager.setStrategyUtils
exports.getStrategyUtils = symbolManager.getStrategyUtils

// Order Manager Exports
exports.getClientCoinBalance = orderManager.getClientCoinBalance
exports.MAX_AMOUNT = orderManager.MAX_AMOUNT

// Export configuration
exports.Config = Config
