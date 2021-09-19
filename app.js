'use strict'

require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const app = express()

app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}))

app.get('/', async function (req, res) {
    res.send('This is Just Another Trading Bot!')
})

require('./server/routes')(app)

const JATB = require('./server/engine/Core')
JATB.start()
    .then(() => {
        // console.log('\t[Enjoy with JATB]\t')
    })
    .catch((error) => {
        console.log(error)
    })

app.use((req, res) => {
    res.status(404)
})

app.listen(8081)
