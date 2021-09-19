'use strict'

let user = require('../mongodb/models/User')

async function authenticate (apiKey, apiSecret) {
    return await getUserData(apiKey)
        .then(async (userData) => {
            return userData.apiSecret === apiSecret // TODO: Bind
        })
        .catch((error) => {
            console.trace(error)
            return false
        })
}

async function getUserData (apiKey) {
    return await user.getUserData(apiKey)
        .then(async (data) => {
            return data._doc
        })
        .catch((error) => {
            console.trace(error)
            return { 'error': 'ERR: apiKey or apiSecret wrong' }
        })
}

async function register (apiKey, apiSecret, username) {
    const userData = { // TODO: Bind
        'apiKey': apiKey,
        'apiSecret': apiSecret,
        'username': username,
        'active': true,
    }
    return await user.saveUser({ userData })
        .then((status, error) => {
            if (error) {
                return error
            }
            return status
        })
        .catch((error) => {
            console.trace(error)
        })
}

module.exports = {
    authenticate,
    register
}
