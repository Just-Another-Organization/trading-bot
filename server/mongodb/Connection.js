'use strict'

const Mongoose = require('mongoose')
const dbConfig = require('./config/DBConfig')
const LOG_TAG = '\t[MONGODB]\t|\t'

Mongoose.connect(dbConfig.url, dbConfig.mongoOptions)
    .then(() => {
        console.log(LOG_TAG + 'Connected')
    })
    .catch((error) => {
        console.trace(error)
    })

Mongoose.connection.on('error', (error) => {
    if (error) {
        console.trace(error)
    }
})

Mongoose.Promise = global.Promise

const setOptions = Mongoose.Query.prototype.setOptions;

Mongoose.Query.prototype.setOptions = function (options, overwrite) {
    setOptions.apply(this, arguments)
    if (this.options.lean == null) {
        this.options.lean = true
    }
    return this
};

module.exports = {
    Mongoose,
    models: {
        user: require('./schemas/user.js'),
        trade: require('./schemas/trade.js'),
        symbol: require('./schemas/symbol.js'),
        candle: require('./schemas/candle.js')
    }
}
