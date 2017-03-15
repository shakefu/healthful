/**
 * Internal healthful library API
 */

// System
var http = require('http')
var assert = require('assert')


function HealthCheck (opt) {
    // Options object
    opt = opt || {}
    this.service = opt.service
    this.statsd = opt.statsd || null
    this.http = opt.http || null

    assert(this.service && this.service.length, "Service name is required")
    assert(this.service.match(/^[a-zA-Z0-9_.]+$/), "Service name may only "
            "contain numbers, letters, underscores and dots.");

    this.init()
}

/**
 * Initialize subclients and services.
 */
HealthCheck.prototype.init = function HealthCheck_init () {
    if (this.http) this.initHttp()
    if (this.statsd) this.initStatsd()
}


/**
 * Initialize Http check
 */
HealthCheck.prototype.initHttp = function HealthCheck_initHttp () {
    // Create a server on port 3301
    // TODO: try/catch this so it can't fail
    this.server = http.createServer(this.handleRequest.bind(this))
    this.server.listen(3000)
}

