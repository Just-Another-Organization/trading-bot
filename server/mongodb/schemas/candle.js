'use strict'

const Mongoose = require('mongoose')

const CandleSchema = new Mongoose.Schema({
    interval: {
        type: String,
        required: true,
        index: true
    },

    symbol: {
        type: String,
        required: true,
        index: true
    },

    historicalData: [{
        openTime: {
            type: Number,
            required: true
        },
        open: {
            type: String,
            required: true
        },
        high: {
            type: String,
            required: true
        },
        low: {
            type: String,
            required: true
        },
        close: {
            type: String,
            required: true
        },
        volume: {
            type: String,
            required: true
        },
        closeTime: {
            type: Number,
            required: true
        },
        quoteAssetVolume: {
            type: String,
            required: true
        },
        trades: {
            type: Number,
            required: true
        },
        baseAssetVolume: {
            type: String,
            required: true
        },
    }]
})

const candleModel = Mongoose.model('candle', CandleSchema)

module.exports = candleModel
