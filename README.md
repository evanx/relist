# relist

Import from set to queue.

<img src='https://raw.githubusercontent.com/evanx/relist/master/docs/readme/images/main.png'>


## Use case

We wish to send alerts for application errors to a Slack channel.

Our application services use a logger which writes errors into Redis.  

Consider the following common error logging method.
```javascript
    logger.error(err);
```

The implementation logs the latest error into Redis, according to the client ID.
```javascript
    multi.hmset(`reconsole:error:${clientId}:h`, {
        time: new Date(timestamp).toISOString(),
        message: err.message
    });
    multi.sadd('reconsole:error:s', clientId);
```

e.g. see Uses application archetype: https://github.com/evanx/reconsole

This service will `POST` alerts to a Slack channel, e.g. in collaboration with `reconsole.`


## Configuration

See `lib/spec.js` https://github.com/evanx/relist/blob/master/lib/spec.js

```javascript
module.exports = pkg => ({
    description: pkg.description,
    env: {
        redisHost: {
            description: 'the Redis host',
            default: 'localhost'
        },
        redisPort: {
            description: 'the Redis port',
            default: 6379
        },
        redisNamespace: {
            description: 'the Redis namespace',
            default: 'relist'
        },
        slackUrl: {
            description: 'Slack URL',
        },
        slackChannel: {
            description: 'Slack channel',
            default: '#ops'
        },
        slackUsername: {
            description: 'Slack username',
            default: 'relistBot'
        },
        slackIcon: {
            description: 'Slack icon emoji',
            default: 'monkey'
        },
        popDelay: {
            description: 'pop delay',
            unit: 'ms',
            default: 2000
        },
        popTimeout: {
            description: 'pop timeout',
            unit: 'ms',
            default: 2000
        }
    },
    redisK: config => ({
        reqS: {
            key: `${config.redisNamespace}:req:s`
        },
        reqQ: {
            key: `${config.redisNamespace}:req:q`
        },
        reqH: {
            key: sha => `${config.redisNamespace}:${sha}:req:h`
        },
        busyQ: {
            key: `${config.redisNamespace}:busy:q`
        },
        reqC: {
            key: `${config.redisNamespace}:req:count:h`
        },
        errorC: {
            key: `${config.redisNamespace}:error:count:h`
        }
    })
});
```

## Docker

See `Dockerfile` https://github.com/evanx/relist/blob/master/Dockerfile
```
FROM mhart/alpine
ADD package.json .
RUN npm install --silent
ADD lib lib
ENV NODE_ENV production
CMD ["node", "lib/index.js"]
```

We can build as follows:
```shell
docker build -t relist https://github.com/evanx/relist.git
```
where tagged as image `relist`

Then for example, we can run on the host's Redis as follows:
```shell
docker run --network=host -e slackUrl=$SLACK_URL relist
```
where `--network-host` connects the container to your `localhost` bridge. The default Redis host `localhost` works in that case.

Since the containerized app has access to the host's Redis instance, you should inspect the source.


## Implementation

See `lib/main.js` https://github.com/evanx/relist/blob/master/lib/main.js
```javascript
    const sha = await client.brpoplpushAsync(redisK.reqQ, redisK.busyQ, config.popTimeout);
    const [hashes] = await multiExecAsync(client, multi => {
        multi.hgetall(redisK.reqH(sha));
        multi.hincrby(redisK.reqC, 'pop', 1);
    });
    asserto({hashes});
    const {text} = hashes;
    asserto({text});
    const payload = {
        channel: config.slackChannel,
        username: config.slackUsername,
        icon_emoji: [':', config.slackIcon, ':'].join(''),
        text
    };
    const fetchRes = await fetch(req.url, {
        url: config.slackUrl,
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded'
        },
        body: 'payload=' + JSON.stringify(payload).replace(/"/g, '\'')
    });
    if (fetchRes.status !== 200) {
        throw new DataError(`Status ${fetchRes.status}`, payload);
    }
```

Uses application archetype: https://github.com/evanx/redis-koa-app


<hr>

https://twitter.com/@evanxsummers
