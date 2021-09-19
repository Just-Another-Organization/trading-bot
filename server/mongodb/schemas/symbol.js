'use strict'

const Mongoose = require('mongoose')

const SymbolSchema = new Mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        index: true,
        unique: true
    },

    baseAsset: {
        type: String,
        required: true
    },

    quoteAsset: {
        type: String,
        required: true
    },

    tickSizePrice: {
        type: Number,
        required: true
    },

    stepSizeLot: {
        type: Number,
        required: true
    },

    sensibilityDigits: {
        type: Number,
        required: true
    },

    minimumQuantity: {
        type: Number,
        required: true
    },
    timeToStartIgnore: {
        type: Number,
        required: false,
        default: null
    },
    timeToIgnore: {
        type: Number,
        required: false,
        default: null
    },
    marketCap: {
        type: Number,
        required: true,
        default: 0
    },
    strategiesUtils: [{
        type: Object,
        required: false,
        default: null
    }]
})

const symbolModel = Mongoose.model('symbol', SymbolSchema)

module.exports = symbolModel
