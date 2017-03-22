# healthful

*healthful* provides HTTP health check endpoints and/or StatsD health check
pings for services. This is geared towards micro-services which don't already
expost HTTP endpoints that could be health checked or don't otherwise generate
stats traffic that might be monitored for health.

If the HTTP listener is enabled, then *healthful* will by default create a
listening HTTP server on port `3301`, and respond with JSON content indicating
the status of the service, along with the HTTP status 200 if it is healthy, or
503 if it is unhealthy. This should work with most load balancer health checks.

## Installation

```
yarn install healthful
```

Or `npm install --save healthful` if you're not cool.

## Usage

```
const health = new require('healthful')({service: 'example', http: true})

// Some repeating code that you can count on
health.ping()
```

## API

*TODO: Api docs*

