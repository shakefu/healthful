/**
 * There probably should be real tests at some point.
 */
var assert = require('assert')

describe("healthful", function () {
    it("loads", function () {
        var health = require('./index')
        assert(health, "Healthful didn't load.")
    })
})

