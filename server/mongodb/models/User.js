'use strict'

const userModel = require('../Connection').models.user

async function isUserOfDB(apiKey) {
    return new Promise((resolve, reject) => {
        userModel.findOne({'apiKey': apiKey}, (error, userData) => {
            if (userData !== null) {
                console.log('User - isUserOfDb - True')
                resolve(true)
            } else {
                if (!error) {
                    console.log('User - isUserOfDb - False')
                    resolve(false)
                } else {
                    console.log('User - isUserOfDb - ERROR: ' + error)
                    reject(error)
                }
            }
        })
    })
}

async function isUsernameOfDB(username) {
    return new Promise((resolve, reject) => {
        userModel.findOne({'username': username}, (error, userData) => {
            if (userData !== null) {
                resolve(true)
            } else {
                if (!error) {
                    resolve(false)
                } else {
                    reject(error)
                }
            }
        })
    })
}

async function saveUser({userData}) {
    const isAlreadyUser = await isUserOfDB(userData.apiKey)
    const isValidUsername = !await isUsernameOfDB(userData.username)

    return new Promise((resolve, reject) => {
        if (!isAlreadyUser && isValidUsername) {
            const user = new userModel(userData)

            user.save((error, data) => {
                if (data !== null) {
                    console.log('User - saveUser - Saved')
                    resolve(true)
                } else {
                    if (!error) {
                        console.log('User - saveUser - Not Saved')
                        resolve(false)
                    } else {
                        console.log('User - saveUser - ERROR: ' + error)
                        reject(error)
                    }
                }
            })
        }
    })
}

async function getUserData(apiKey) {
    const isValidUserID = isUserOfDB(apiKey)

    return new Promise((resolve, reject) => {
        if (isValidUserID) {
            userModel.findOne({'apiKey': apiKey}, (error, userData) => {
                if (userData !== null) {
                    //console.log('User - getUserData - Data:' + userData)
                    const user = new userModel(userData)
                    resolve(user)
                } else {
                    if (!error) {
                        console.log('User - getUserData - No Data')
                        reject(error)
                    } else {
                        console.log('User - getUserData - ERROR: ' + error)
                        reject(error)
                    }
                }
            })
        }
    })
}

async function changeUserData({userData}) {
    const isAlreadyUser = await isUserOfDB(userData.apiKey)

    return new Promise((resolve, reject) => {
        if (!isAlreadyUser) {
            resolve(userModel.updateOne({'apikey': userData.apikey},
                {
                    $set: {
                        'apiSecret': userData.apiSecret,
                        'username': userData.username,
                        'active': userData.active
                    }
                })
                .exec())
        }
    })
}

module.exports = {
    isUserOfDB,
    saveUser,
    getUserData,
    changeUserData
}
