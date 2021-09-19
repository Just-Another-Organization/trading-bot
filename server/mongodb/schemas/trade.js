'use strict'

const Mongoose = require('mongoose')

const TradeSchema = new Mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        index: true
    },

    interval: {
        type: String,
        required: true,
        index: true
    },

    entryPrice: {
        type: Number,
        required: true
    },

    amount: {
        type: Number,
        required: true
    },

    reward: {
        type: Number,
        required: true
    },

    stopLossPercentage: {
        type: Number,
        required: false
    },

    takeProfitPercentage: {
        type: Number,
        required: false
    }
})

const tradeModel = Mongoose.model('trade', TradeSchema)

module.exports = tradeModel
