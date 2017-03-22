# healthful

*healthful* provides HTTP health check endpoints and/or StatsD health check
pings for services. This is geared towards micro-services which don't already
expost HTTP endpoints that could be health checked or don't otherwise generate
stats traffic that might be monitored for health.

## Installation

```
yarn install healthful
```

Or `npm install --save healthful` if you're not cool.

## Usage

*TODO: Better docs*

```
const health = require('healthful')({service: 'example', http: true})

// Some repeating code that you can count on
health.ping()
```

