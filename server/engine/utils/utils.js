'use strict'

function getSyncLoopTime(interval) {
    const intervalTimestamp = getTimestampByInterval(interval)
    return intervalTimestamp - new Date().getTime() % intervalTimestamp;
}

function getSyncLoopTimeSeconds(interval) {
    const syncTimestamp = getSyncLoopTime(interval)
    return Math.floor(syncTimestamp / 1000)
}

function getTimestampByInterval(interval) {
    // intervals = ['1M', '1w', '3d', '1d', '12h', '8h', '6h', '4h', '2h', '1h', '30m', '15m', '5m', '3m', '1m']
    let intervalDigit = interval.substring(0, interval.length - 1)
    let intervalPeriod = interval.substring(interval.length - 1, interval.length)

    const periods = {
        'm': 60,
        'h': 3600,      // 60 * 60
        'd': 86400,     // 24 * 60 * 60
        'w': 604800,    // 7 * 24 * 60 * 60,
        'M': 2592000,   // 30 * 24 * 60 * 60,
    }
    let timeMultiplier = periods[intervalPeriod]
    return intervalDigit * timeMultiplier * 1000
}

function isEmpty(obj) {
    return !obj || Object.keys(obj).length === 0;
}

module.exports = {
    getSyncLoopTime,
    getSyncLoopTimeSeconds,
    getTimestampByInterval,
    isEmpty
}
