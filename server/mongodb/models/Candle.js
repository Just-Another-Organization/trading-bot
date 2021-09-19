'use strict'

const candleModel = require('../Connection').models.candle

const utils = require('../../engine/utils/utils')

async function isCandleOfDB(interval, symbol) {
    return new Promise((resolve, reject) => {
        candleModel.findOne({
            'interval': interval,
            'symbol': symbol
        }, (error, candleData) => {
            if (candleData !== null && candleData !== undefined) {
                resolve(true)
            } else {
                resolve(false)
            }
        })
    })
}

async function saveCandle({candleData}) {
    return new Promise((resolve, reject) => {
        const candle = new candleModel(candleData)
        candle.save((error, data) => {
            if (data !== null) {
                resolve(true)
            } else {
                reject(false)
            }
        })
    })
}

async function getCandleData(symbol) {
    return new Promise((resolve, reject) => {
        candleModel.findOne({'symbol': symbol}, (error, candleData) => {
            if (candleData !== null && candleData !== undefined) {
                const candle = new candleModel(candleData)
                resolve(candle)
            } else {
                reject(error)
            }
        }).exec()
    })
}

async function getCandleHistoricalData(interval, symbol) {
    return new Promise((resolve, reject) => {
        candleModel.findOne({
            'interval': interval,
            'symbol': symbol
        }, (error, candleData) => {
            if (candleData !== null && candleData !== undefined) {
                const candle = new candleModel(candleData)
                resolve(candle.historicalData)
            } else {
                reject(error)
            }
        }).exec()
    })
}

function getAllCandleData() {
    return candleModel.find({}).exec()
}

async function deleteOne(interval, symbol) {
    return new Promise((resolve, reject) => {
        resolve(candleModel.deleteOne({
            'interval': interval,
            'symbol': symbol
        }).exec())
    })
}

module.exports = {
    isCandleOfDB,
    saveCandle,
    getCandleData,
    getCandleHistoricalData,
    getAllCandleData,
    deleteOne
}
