/**
 * Internal healthful library API
 */

// System
var http = require('http')
var assert = require('assert')

// 3rd party
var debug = require('debug')


function Healthful (opt) {
    // Options object
    opt = opt || {}
    this.service = opt.service
    this.statsd = opt.statsd || null
    this.http = opt.http || null
    this.interval = opt.interval || 60*1000
    this.healthy = false

    assert(this.service && this.service.length, "Service name is required")
    assert(this.service.match(/^[a-zA-Z0-9_.]+$/), "Service name may only "+
            "contain numbers, letters, underscores and dots.")
    assert(Number.isInteger(this.interval), "Check interval must be an integer")

    // Set empty timeout handle
    this._timeout = null

    // Create debug
    this.debug = debug('healthful:' + this.service)

    this.init()
}
exports.Healthful = Healthful


/**
 * Initialize subclients and services.
 */
Healthful.prototype.init = function Healthful_init () {
    // Initialize HTTP listener or StatsD client.
    if (this.http) this.initHttp()
    if (this.statsd) this.initStatsd()

    // Output helpful debug if this isn't doing anything
    if (!this.http && !this.statsd) {
        this.debug("Not initializing any healthcheck, not configured.")
    }
}


/**
 * Initialize Http check
 */
Healthful.prototype.initHttp = function Healthful_initHttp () {
    assert(this.http, "HTTP listener improperly configured")

    // Allow for enable http with all defaults by specifying `true`
    if (this.http === true) this.http = {}

    // Default the port to 3301, which is unused according to IANA
    if (!this.http.port) this.http.port = process.env.HEALTHFUL_PORT || 3301
    assert(Number.isInteger(this.http.port), "HTTP port must be an integer")

    // Default the binding to public
    if (!this.http.bind) this.http.bind = (process.env.HEALTHFUL_BIND
        || '0.0.0.0')
    assert(typeof this.http.bind == 'string', "HTTP bind must be a string")

    // Deafult the content type to JSON
    if (!this.http.content_type) this.http.content_type = (
        process.env.HEALTHFUL_CONTENT_TYPE || 'application/json')
    assert(typeof this.http.content_type == 'string',
        "HTTP content type must be a string")

    // Default the response to a JSON ok
    if (!this.http.response) this.http.response = (
        process.env.HEALTHFUL_RESPONSE ||
        '{"service": "{{service}}", "healthful": {{healthy}}}')
    assert(typeof this.http.response == 'string',
        "HTTP response must be a string")

    // Create the server
    try {
        // Bind our request listener while creating the server
        this.server = http.createServer(this.handleRequest.bind(this))
        // Start listening on the right IP bind and port
        this.server.listen(this.http.port, this.http.bind, function () {
            try {
                this.debug("Listening on " + this.http.bind + ':' +
                    this.http.port)
            }
            catch (err) {
                this.debug("Error:", err)
            }
        }.bind(this))
        // Unref the server so it doesn't cause process hangs
        this.server.unref()
    }
    catch (err) {
        this.debug("Error creating Healthful listener:", err)
    }
}


/**
 * Return a response JSON string with template like behavior.
 */
Healthful.prototype.getResponse = function Healthful_getResponse () {
    var res = '' + this.http.response
    res = res.replace(/{{ *service *}}/gi, this.service)
    res = res.replace(/{{ *healthy *}}/gi, this.healthy)
    return res
}


/**
 * Health responder.
 */
Healthful.prototype.handleRequest = function Healthful_handleRequest (req, res) {
    res.setHeader('Content-type', this.http.content_type)
    res.setHeader('X-Healthful', Date.now().toString())
    res.writeHead(200)
    res.write(this.getResponse())
    res.end()
}


/**
 * Get StatsD going.
 */
Healthful.prototype.initStatsd = function Healthful_initStatsd () {
    this.debug("Not implemented.")
}


/**
 * Register a healthy state.
 */
Healthful.prototype.ping = function Healthful_ping () {
    this.debug("Ping")

    // Clear the previous timeout if it existed
    if (this._timeout) clearTimeout(this._timeout)

    // Update the healthy flag to be true
    this.healthy = true

    // Set the timeout to flip the healthy flag
    this._timeout = setTimeout(function Healthful_unhealhty () {
        this.debug("Ping timeout")
        this.healthy = false
    }.bind(this), this.interval)

    // Unref the timeout so we don't cause hangs
    this._timeout.unref()
}

