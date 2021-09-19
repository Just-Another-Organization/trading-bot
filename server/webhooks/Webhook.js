'use strict'

const Config = require('../engine/Config.json')
const axios = require('axios')
const ENV_WEBHOOK_URLS = process.env.WEBHOOK_URLS || undefined
const CONFIG_WEBHOOK_URLS = Config.WEBHOOK_URLS
const ENABLE_WEBHOOK = Config.ENABLE_WEBHOOK
const BACKTESTING_MODE = Config.BACKTESTING.BACKTESTING_MODE
const LOG_TAG = '\t[WEBHOOK]\t|\t'

let WEBHOOK_URLS = []
if (ENV_WEBHOOK_URLS === undefined || ENV_WEBHOOK_URLS.length <= 0) {
    WEBHOOK_URLS = CONFIG_WEBHOOK_URLS
} else {
    WEBHOOK_URLS = CONFIG_WEBHOOK_URLS.concat(ENV_WEBHOOK_URLS)
}

for (let i = 0; i < WEBHOOK_URLS.length; i++) {
    if (WEBHOOK_URLS[i] === '') {
        WEBHOOK_URLS.splice(i, 1)
    }
}

/**
 * The APIKEYs are generated using: "head /dev/urandom | tr -dc A-Za-z0-9 | head -c 30"
 */
const X_API_KEY = process.env.APIKEY || Config.APIKEY
axios.defaults.headers.common['X-API-KEY'] = X_API_KEY

async function openTrade (tradeData) {
    console.log(LOG_TAG + 'openTrade ' + tradeData.symbol)
    let webhookData = {
        'type': 'Open trade',
        'data': tradeData
    }
    await sendWebhook(webhookData)
}

async function closeTrade (tradeData) {
    console.log(LOG_TAG + 'closeTrade ' + tradeData.symbol)
    let webhookData = {
        'type': 'Closed trade',
        'data': tradeData
    }
    await sendWebhook(webhookData)
}

async function uncaughtError (error) {
    console.log(LOG_TAG + 'error sent')
    let webhookData = {
        'type': 'Uncaught error',
        'data': {
            'Content': 'Error'
        }
    }
    await sendWebhook(webhookData)
}

async function uncaughtWarning (warning) {
    console.log(LOG_TAG + 'warning sent')
    let webhookData = {
        'type': 'Uncaught warning',
        'data': {
            'Content': 'Warning'
        }
    }
    await sendWebhook(webhookData)
}

async function sendWebhook (webhookData) {
    if (!BACKTESTING_MODE && ENABLE_WEBHOOK) {
        try {
            for (let i = 0; i < WEBHOOK_URLS.length; i++) {
                let url = new URL(WEBHOOK_URLS[i])
                axios.post(url.href, webhookData)
                    .then((res) => {
                        console.log(LOG_TAG + res.data)
                    })
                    .catch((error) => {
                        console.error(error)
                    })
            }
        } catch (error) {
            console.trace(error)
        }
    }
}

module.exports = {
    openTrade,
    closeTrade,
    uncaughtError,
    uncaughtWarning
}
