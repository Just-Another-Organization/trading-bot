'use strict'

const STRUCTURED = 'STRUCTURED'
const SYNCED = 'SYNCED'
const CANDLES = 'CANDLES'

const OrderedMap = new Map();

function setCache(cacheKey, data) {
    OrderedMap.set(cacheKey, JSON.stringify(data))
}

function getCache(cacheKey) {
    const data = OrderedMap.get(cacheKey)
    if (data) {
        return JSON.parse(data)
    } else {
        return null
    }
}

function removeCache(cacheKey) {
    OrderedMap.remove(cacheKey)
}

module.exports = {
    STRUCTURED,
    CANDLES,
    SYNCED,
    setCache,
    getCache,
    removeCache
}
