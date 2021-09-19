'use strict'

const LOG_TAG = '\t[API]\t|\t'

module.exports = (app) => {
    const user = require('./users/UserManager')
    const jatb = require('./engine/BotManager')
    const BASE_API_URL = '/api'
    const VERSION = '/v1.0'
    const USER = '/user'
    const BOT = '/bot'

    // app.post(BASE_API_URL + VERSION + USER + '/register', async (req, res) => {
    //     res.setHeader('Content-Type', 'application/json')
    //     await user.register(req.body.apiKey, req.body.apiSecret, req.body.username)
    //         .then((status) => {
    //             res.json({ 'status': status }).end()
    //         })
    //         .catch((error) => {
    //             console.trace(error)
    //             res.status(500).json({ error: error }).end()
    //         })
    // })

    // app.post(BASE_API_URL + VERSION + USER + '/authenticate', async (req, res) => {
    //     res.setHeader('Content-Type', 'application/json')
    //     await user.authenticate(req.body.apiKey, req.body.apiSecret)
    //         .then((status) => {
    //             res.json({ 'status': status }).end()
    //         })
    //         .catch((error) => {
    //             console.trace(error)
    //             res.status(500).json({ error: error }).end()
    //         })
    // })

    // app.post(BASE_API_URL + VERSION + BOT + '/get-user-data', async (req, res) => {
    //     console.log('Called Get User Data')
    //     res.setHeader('Content-Type', 'application/json')
    //     await jatb.getOpenTrades(res.apiKey)
    //         .then((userData) => {
    //             res.json({ 'userData': userData }).end()
    //         })
    //         .catch((error) => {
    //             console.trace(error)
    //             res.status(500).json({ error: error }).end()
    //         })
    // })

    app.post(BASE_API_URL + VERSION + BOT + '/get-open-trades', async (req, res) => {
        console.log(LOG_TAG + 'Called Get Open Trade')
        res.setHeader('Content-Type', 'application/json')
        await jatb.getOpenTrades() // TODO Set req.body.apiKey, req.body.apiSecret, req.body.username
            .then((openTrades) => {
                res.json({'openTrades': openTrades}).end()
            })
            .catch((error) => {
                console.trace(error)
                res.status(500).json({error: error}).end()
            })
    })

    app.post(BASE_API_URL + VERSION + BOT + '/close-trade', async (req, res) => {
        console.log(LOG_TAG + 'Called Close Trade')
        res.setHeader('Content-Type', 'application/json')
        let apikey = '' // req.body.apikey
        let symbol = req.body.symbol
        await jatb.closeTrade(apikey, symbol) // TODO Set req.body.apiKey, req.body.apiSecret, req.body.username
            .then((status) => {
                res.json({
                    'symbol': symbol,
                    'closedTrade': status
                }).end()
            })
            .catch((error) => {
                console.trace(error)
                res.status(500).json({ error: error }).end()
            })
    })

    // app.post(BASE_API_URL + VERSION + BOT + '/change-user-data', async (req, res) => {
    //     console.log('Change User Data')
    //     res.setHeader('Content-Type', 'application/json')
    //     await jatb.changeUserData(res.userData) // TODO Set req.body.apiKey, req.body.apiSecret, req.body.username
    //         .then((status) => {
    //             res.json({ 'status': status }).end()
    //         })
    //         .catch((error) => {
    //             console.trace(error)
    //             res.status(500).json({ error: error }).end()
    //         })
    // })
}
