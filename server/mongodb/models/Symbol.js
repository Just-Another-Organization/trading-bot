'use strict'

const symbolModel = require('../Connection').models.symbol

async function isSymbolOfDB(symbol) {
    return new Promise((resolve, reject) => {
        symbolModel.findOne({'symbol': symbol}, (error, symbolData) => {
            if (symbolData !== null && symbolData !== undefined) {
                resolve(true)
                // console.log('Symbol - isSymbolOfDb - True')
            } else {
                if (error) {
                    // console.log('Symbol - isSymbolOfDb - ERR: ' + error)
                    reject(error)
                } else {
                    // console.log('Symbol - isSymbolOfDb - False')
                    resolve(false)
                }
            }
        })
    })
}

async function isSymbolToIgnore(symbol) {
    return new Promise((resolve, reject) => {
        symbolModel.findOne({'symbol': symbol}, async (error, symbolData) => {
            if (symbolData !== null && symbolData !== undefined) {
                if (!symbolData.timeToStartIgnore || !symbolData.timeToIgnore) {
                    resolve(false)
                }
                if (symbolData.timeToStartIgnore + symbolData.timeToIgnore > Date.now()) {
                    resolve(true)
                }
                await cleanTimeToIgnore(symbol)
                resolve(false)
            } else {
                reject(error)
            }
        })
    })
}

async function saveSymbol(symbolData) {
    return new Promise((resolve, reject) => {
        const symbol = new symbolModel(symbolData)
        symbol.save((error, data) => {
            if (data !== null) {
                //console.log('Symbol - saveSymbol - Saved')
                resolve(true)
            } else {
                if (!error) {
                    // console.log('Symbol - saveSymbol - Not Saved')
                    reject(false)
                } else {
                    // console.log('Symbol - saveSymbol - ERR: ' + error)
                    reject(error)
                }
            }
        })
    })
}

async function getSymbolData(symbol) {
    return new Promise((resolve, reject) => {
        symbolModel.findOne({'symbol': symbol}, (err, symbolData) => {
            if (symbolData !== null && symbolData !== undefined) {
                // console.log('Symbol - getSymbolData - Data:' + symbolData)
                const symbol = new symbolModel(symbolData)
                resolve(symbol)
            } else {
                reject(err)
            }
        })
    })
}

async function getSymbolsDataByQuoteAsset(quoteAsset) {
    return new Promise((resolve, reject) => {
        symbolModel.find({'quoteAsset': quoteAsset}, (err, symbolsData) => {
            if (symbolsData !== null && symbolsData !== undefined) {
                let symbols = []
                let symbol
                for (let i = 0; i < symbolsData.length; i++) {
                    symbol = new symbolModel(symbolsData[i])
                    symbols.push(symbol)
                }
                resolve(symbols)
            } else {
                if (err) {
                    reject(err)
                } else {
                    reject(err)
                }
            }
        })
    })
}

function getAllSymbolData() {
    return symbolModel.find({}).exec()
}

async function deleteOne(symbol) {
    return new Promise((resolve, reject) => {
        resolve(symbolModel.deleteOne({'symbol': symbol}).exec())
    })
}

async function setTimeToIgnore(symbol, time) {
    return new Promise((resolve, reject) => {
        resolve(symbolModel.updateOne({'symbol': symbol},
            {
                $set: {
                    'timeToStartIgnore': Date.now(),
                    'timeToIgnore': time,
                }
            })
            .exec())
    })
}

async function cleanTimeToIgnore(symbol) {
    return new Promise((resolve, reject) => {
        resolve(symbolModel.updateOne({'symbol': symbol},
            {
                $set: {
                    'timeToStartIgnore': null,
                    'timeToIgnore': null,
                }
            })
            .exec())
    })
}

async function setStrategyUtils(symbol, strategyName, utilsObject) {
    return new Promise((resolve, reject) => {
        symbolModel.findOneAndUpdate(
            {
                'symbol': symbol
            },
            {
                'strategiesUtils': {
                    'strategyName': strategyName,
                    'utilsObject': utilsObject
                }
            },
            {
                new: true,
                upsert: true
            },
            (error, strategyUtilsData) => {
                if (strategyUtilsData !== null && strategyUtilsData !== undefined) {
                    resolve(strategyUtilsData)
                } else {
                    console.log('ERROR setStrategyUtils: ' + error)
                    reject(error)
                }
            })
    })
}

async function getStrategyUtils(symbol, strategyName) {
    return new Promise((resolve, reject) => {
        symbolModel.findOne({
            'symbol': symbol
        }, (error, symbolData) => {
            if (symbolData !== null && symbolData !== undefined) {
                let strategiesUtils = symbolData.strategiesUtils
                if (strategiesUtils) {
                    for (let i = 0; i < strategiesUtils.length; i++) {
                        if (strategiesUtils[i].strategyName === strategyName) {
                            resolve(strategiesUtils[i].utilsObject)
                        }
                    }
                }
                resolve({})
            } else {
                console.log('ERROR getStrategyUtils: ' + error)
                reject(error)
            }
        })
    })
}

module.exports = {
    isSymbolOfDB,
    isSymbolToIgnore,
    saveSymbol,
    getSymbolData,
    getAllSymbolData,
    deleteOne,
    getSymbolsDataByQuoteAsset,
    setTimeToIgnore,
    cleanTimeToIgnore,
    setStrategyUtils,
    getStrategyUtils
}
