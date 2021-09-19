'use strict'

const CREDENTIALS = require('../Config.json').CREDENTIALS
const BinanceApi = require('binance-api-node').default

const credentials = Object.assign({}, CREDENTIALS);

if (credentials.API_KEY === '' || credentials.API_SECRET === '') {
    credentials.API_KEY = process.env.BINANCE_API_KEY
    credentials.API_SECRET = process.env.BINANCE_API_SECRET
}

const botClient = BinanceApi({
    apiKey: credentials.API_KEY,
    apiSecret: credentials.API_SECRET
})

module.exports = {
    botClient
}
