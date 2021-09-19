'use strict'

const tradeModel = require('../Connection').models.trade

async function isTradeOfDB(symbol) {
    return new Promise((resolve, reject) => {
        tradeModel.findOne({'symbol': symbol}, (err, tradeData) => {
            if (tradeData !== null) {
                resolve(true)
            } else {
                if (!err) {
                    resolve(false)
                } else {
                    reject(err)
                }
            }
        })
    })
}

async function saveTrade({tradeData}) {
    return new Promise((resolve, reject) => {
        const trade = new tradeModel(tradeData)
        trade.save((err, data) => {
            if (err) {
                reject(false)
            } else {
                resolve(true)
            }
        })
    })
}

async function getTradeData(symbol) {
    return new Promise((resolve, reject) => {
        tradeModel.findOne({'symbol': symbol}, (err, tradeData) => {
            if (tradeData !== null && tradeData !== undefined) {
                const trade = new tradeModel(tradeData)
                resolve(trade)
            } else {
                if (err) {
                    reject(err)
                } else {
                    resolve(null)
                }
            }
        })
    })
}

async function getAllTradeData() {
    return await tradeModel.find({}).exec()
}

async function deleteOne(symbol) {
    return new Promise((resolve, reject) => {
        resolve(tradeModel.deleteOne({'symbol': symbol}).exec())
    })
}

async function setReward(symbol, reward) {
    return new Promise((resolve, reject) => {
        resolve(tradeModel.updateOne({'symbol': symbol},
            {$set: {'reward': reward}})
            .exec())
    })
}

async function setStopLoss(symbol, stopLossPercentage) {
    return new Promise((resolve, reject) => {
        resolve(tradeModel.updateOne({'symbol': symbol},
            {$set: {'stopLossPercentage': stopLossPercentage}})
            .exec())
    })
}

async function setTakeProfit(symbol, takeProfitPercentage) {
    return new Promise((resolve, reject) => {
        resolve(tradeModel.updateOne({'symbol': symbol},
            {$set: {'takeProfitPercentage': takeProfitPercentage}})
            .exec())
    })
}

module.exports = {
    isTradeOfDB,
    saveTrade,
    getTradeData,
    setReward,
    getAllTradeData,
    deleteOne,
    setStopLoss,
    setTakeProfit
}
