'use strict'

const UPTREND_DIRECTION = 'UPTREND'
const DOWNTREND_DIRECTION = 'DOWNTREND'
const BOTH_TREND_DIRECTION = 'BOTH_TREND_DIRECTION'

/**
 The levels (R1, S1, R2, S2) generate the following signals:
 - R1: Sell signal if touched (Resistance repels prices).
 - S1: Buy signal if touched (Support rejects prices).
 - R2: Signal of purchase if violated (Start of a bullish trend).
 - S2: Signal of sale if violated (Start of a bearish trend).

 Output:
 [
 {
     c: 6603,
     h: 6632,
     l: 6580,
     floor: {
       r3: 6682,
       r2: 6657,
       r1: 6630,
       pl: 6605,
       s1: 6578,
       s2: 6553,
       s3: 6526
     }
 ]
 **/

async function calculateFloorPivot (rowData) {
    // Points structure = [{c: 15,h: 18,l: 5}]
    let structuredPoints = []
    for (let i = 0; i < rowData.length; i++) {
        let point = {
            c: parseFloat(rowData[i].close),
            h: parseFloat(rowData[i].high),
            l: parseFloat(rowData[i].low)
        }
        structuredPoints.push(point)
    }
    return await floorPivots(structuredPoints)
}

async function calculateFibonacciPivot (rowData, trendDirection) {
    //points structure [{ h: 10,l: 5}, {h: 12,l: 8}, {h: 9,l: 7}, {h: 15,l: 6}, {h: 16,l: 9}]
    let structuredPoints = []
    for (let i = 0; i < rowData.length; i++) {
        let point = {
            h: Math.floor(rowData[i].high),
            l: Math.floor(rowData[i].low)
        }
        structuredPoints.push(point)
    }
    return await evaluateFibonacciPivotBasedOnTrend(trendDirection, structuredPoints)
}

async function evaluateFibonacciPivotBasedOnTrend (trendDirection, structuredPoints) {
    switch (trendDirection) {
        case UPTREND_DIRECTION:
            return await fibonacciRetracements(structuredPoints, UPTREND_DIRECTION)
        case DOWNTREND_DIRECTION:
            return await fibonacciRetracements(structuredPoints, DOWNTREND_DIRECTION)
        case BOTH_TREND_DIRECTION:
            let resists = await fibonacciRetracements(structuredPoints, UPTREND_DIRECTION)
            let supports = await fibonacciRetracements(structuredPoints, DOWNTREND_DIRECTION)
            return {
                'resists': resists,
                'supports': supports
            }
    }
}

async function floorPivots (values) {
    let result = []
    for (let i = 0; i < values.length; i++) {
        let pivotLevel = (values[i].h + values[i].l + values[i].c) / 3
        let r1 = 2 * pivotLevel - values[i].l
        let r2 = pivotLevel + values[i].h - values[i].l
        let r3 = r1 + values[i].h - values[i].l
        let s1 = 2 * pivotLevel - values[i].h
        let s2 = pivotLevel - values[i].h + values[i].l
        let s3 = s1 - values[i].h + values[i].l
        let elem = {
            r3: r3,
            r2: r2,
            r1: r1,
            pl: pivotLevel,
            s1: s1,
            s2: s2,
            s3: s3
        }
        result.push(elem)
    }
    return result
}

async function fibonacciRetracements (values, trend) {
    let result = []
    let retracements = [1, 0.618, 0.5, 0.382, 0.236, 0]
    for (let i = 0; i < values.length; i++) {
        let diff = values[i].h - values[i].l
        let elem = []
        for (let r = 0; r < retracements.length; r++) {
            let level = 0
            if (trend === 'DOWNTREND') {
                level = values[i].h - diff * retracements[r]
            } else {
                level = values[i].l + diff * retracements[r]
            }
            elem.push(level)
        }
        result.push(elem)
    }
    return result
}

module.exports = {
    UPTREND_DIRECTION,
    DOWNTREND_DIRECTION,
    BOTH_TREND_DIRECTION,
    calculateFloorPivot,
    calculateFibonacciPivot
}
