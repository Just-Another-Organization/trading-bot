'use strict'

const orderManager = require('./binance-api/OrderManager')
const tradeManager = require('./logics/TradesManager')
const tradeModel = require('../mongodb/models/Trade')
const userModel = require('../mongodb/models/User')

async function getOpenTrades (apiKey) { // TODO use apiKey for users
    return await tradeModel.getAllTradeData()
        .then((data) => {
            return data
        })
        .catch((error) => {
            console.trace(error)
        })
}

async function getUserData (apiKey) {
    return await userModel.getUserData(apiKey) // TODO: login first
        .then((data) => {
            return data
        })
        .catch((error) => {
            console.trace(error)
        })
}

async function changeUserData (userData) {
    return await userModel.changeUserData(userData) // TODO: login first
        .then((status) => {
            return status
        })
        .catch((error) => {
            console.trace(error)
        })
}

async function getUserCoinBalance (apiKey, coin) {
    return await orderManager.getClientCoinBalance(coin) // TODO: login first
        .then((balance) => {
            return balance
        })
        .catch((error) => {
            console.trace(error)
        })
}

async function closeTrade (apiKey, symbol) { // TODO use apiKey for users
    return await tradeManager.sellAsset(symbol)
        .then((status) => {
            return status
        })
        .catch((error) => {
            console.trace(error)
        })
}

module.exports = {
    getOpenTrades,
    getUserData,
    changeUserData,
    getUserCoinBalance,
    closeTrade
}
