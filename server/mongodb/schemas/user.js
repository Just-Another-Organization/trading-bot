'use strict'

const Mongoose = require('mongoose')

const UserSchema = new Mongoose.Schema({
	apiKey: {
		type: String,
		required: true
	},

	apiSecret: {
		type: String,
		required: true
	},

	active: {
		type: Boolean,
		required: true
	},

	username: {
		type: String,
		required: true,
		index: true,
		unique: true
	}
})

const userModel = Mongoose.model('user', UserSchema)

module.exports = userModel
