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

    // Set empty statsd client
    this.statsd_client = null

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
 * Clean up listeners and so forth.
 */
Healthful.prototype.close = function Healthful_close (callback) {
    // End health ping interval if we have one
    clearInterval(this._timeout)

    if (this.statsd_client) {
        if (this.statsd_client.sock) {
            // Close our end of the socket
            // XXX: This only works for UDP, if we support TCP this needs to
            // use .end() in that variant
            this.statsd_client.sock.close()
        }
        // Clean up our client so we don't try to send more
        this.statsd_client = null
    }

    // If we have a server, call it and end
    if (this.server) {
        this.server.close(callback)
        this.server = null
        return
    }

    // Check if callback is a function, and call it
    if (!!(callback && callback.constructor && callback.call
        && callback.apply)) {
        callback()
    }
}


/**
 * Initialize Http check
 */
Healthful.prototype.initHttp = function Healthful_initHttp () {
    this.debug("Initializing HTTP listener")
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

    // Default the response to a JSON template
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
    res.writeHead(this.healthy ? 200 : 503)
    res.write(this.getResponse())
    res.end()
}


/**
 * Get StatsD going.
 */
Healthful.prototype.initStatsd = function Healthful_initStatsd () {
    this.debug("Initializing StatsD client")
    assert(this.statsd, "StatsD improperly configured")

    // Handle the defaults setup
    if (this.statsd === true) this.statsd = {}

    // Default the statsd host to localhost
    if (!this.statsd.host) this.statsd.host = (
        process.env.HEALTHFUL_STATSD_HOST || 'localhost')
    assert(typeof this.statsd.host == 'string', "StatsD host must be a string")

    // Default the statsd port to 8125
    if (!this.statsd.port) this.statsd.port = (
        process.env.HEALTHFUL_STATSD_PORT || 8125)
    assert(Number.isInteger(this.statsd.port), "StatsD port must be an integer")

    // Default the prefix to "healthful"
    if (!this.statsd.prefix) this.statsd.prefix = (
        process.env.HEALTHFUL_STATSD_PORT || 'healthful')
    assert(typeof this.statsd.prefix == 'string', "StatsD prefix is not string")

    // Create the new statsd client
    this.statsd_client = exports.getStatsdClient({
        host: this.statsd.host,
        port: this.statsd.port,
        prefix: this.statsd.prefix,
    })

    if (!this.statsd_client) {
        this.debug("StatsD not available: statsy package is not installed")
    }
    else if (this.statsd_client.sock) {
        // Make sure it never hangs around
        this.statsd_client.sock.unref()
    }
}

/**
 * Register a healthy state.
 */
Healthful.prototype.ping = function Healthful_ping () {
    this.debug("Ping")

    // Clear the previous timeout if it existed
    if (this._timeout) clearInterval(this._timeout)

    // Update the healthy flag to be true
    this.healthy = true

    // Send a healthy ping to StatsD as well, if it's enabled, etc.
    this.pingStatsd()

    // Set the timeout to flip the healthy flag
    this._timeout = setInterval(function Healthful_unhealhty () {
        this.debug("Health timeout")
        this.healthy = false

        // Send an unhealthy ping to statsd
        this.pingStatsd()
    }.bind(this), this.interval)

    // Unref the timeout so we don't cause hangs
    this._timeout.unref()
}


/**
 * Sends a ping to StatsD
 */
Healthful.prototype.pingStatsd = function Healthful_pingStatsd () {
    if (!this.statsd_client) {
        if (this.statsd) {
            this.debug("Statsd ping unavailable")
        }
        return
    }

    var healthy = '.' + (this.healthy ? '' : 'un') + 'healthy'

    try {
        this.statsd_client.count(this.service + healthy, 1)
    }
    catch (err) {
        this.debug("Error:" + err)
    }
}


exports.getStatsdClient = function getStatsdClient (opt) {
    var Statsy
    // Handle if we don't have the optional statsy package installed
    try {
        Statsy = require('statsy')
    }
    catch (err) {
        return null
    }

    return new Statsy(opt)
}
