/**
 * There probably should be real tests at some point.
 */
// System
var assert = require('assert')

// 3rd party
var request = require('supertest')

// Package
var lib = require('./lib')


describe("healthful", function () {
    it("loads", function () {
        var health = require('./index')
        assert(health, "Healthful didn't load.")
    })
})


describe("HTTP", function () {
    var health
    var req

    before(function () {
        health = new lib.Healthful({
            service: 'mocha',
            http: true,
            interval: 10,
        })
        req = request(health.server)
    })

    after(function (done) {
        if (!health) return done()
        health.close(done)
        health = null
    })

    it("works", function () {
        assert(health, "Healthful instance not created")
        assert(health.server, "Healthful server not created")
    })

    it("responds with a 503 if unhealthy", function (done) {
        req.get('/')
        .expect(503, done)
    })

    it("defaults to responding with JSON", function (done) {
        req.get('/')
        .expect('Content-type', 'application/json', done)
    })

    it("responds with the service name and healthful status", function (done) {
        req.get('/')
        .expect({service: 'mocha', healthful: false}, done)
    })

    it("responds on any path", function (done) {
        req.get('/blah')
        .expect(503, done)
    })

    it("changes health status after a ping", function (done) {
        health.ping()
        req.get('/')
        .expect(200)
        .expect({service: 'mocha', healthful: true}, done)
    })

    it("changes health status after ping interval", function (done) {
        setTimeout(function () {
            req.get('/')
            .expect({service: 'mocha', healthful: false}, done)
        }, health.interval)
    })
})


describe("StatsD", function () {
    var health
    var client
    var req

    before(function () {
        health = new lib.Healthful({
            service: 'mocha',
            statsd: true,
            interval: 10,
        })

        client = {
            args: [],
            count: function () {
                client.args.push(Array.prototype.slice.call(arguments))
            },
            orig: health.statsd_client
        }

        health.statsd_client = client
    })

    after(function (done) {
        if (!health) return done()
        health.close(done)
        health = null
    })

    it("works", function () {
        assert(health, "Healthful instance not created")
    })

    it("generates a healthy ping", function () {
        health.ping()
        assert(JSON.stringify(health.statsd_client.args) ==
            JSON.stringify([['mocha.healthy', 1]]),
            "StatsD got wrong arguments")
    })

    it("generates an unhealthy timeout", function (done) {
        setTimeout(function () {
            assert(JSON.stringify(health.statsd_client.args) ==
                JSON.stringify([['mocha.healthy', 1], ['mocha.unhealthy', 1]]),
                "StatsD got wrong arguments")
            done()
        }, health.interval)
    })
})
