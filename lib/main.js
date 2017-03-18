const crypto = require('crypto');
const h = require('render-html-rpf');
const fetch = require('node-fetch');
const mapProperties = require('map-properties');

module.exports = async (api) => {
    api.post('/', async ctx => {
        const body = await ctx.request.body;
        console.log('post /', body, ctx.request.headers);
        ctx.body = 'OK';
    });
    api.get('/', async ctx => {
        multiExecAsync(client, multi => {
            multi.hincrby(redisK.reqC, 'root', 1);
        });
        ctx.redirect('/analytics');
    });
    api.get('/analytics', async ctx => {
        multiExecAsync(client, multi => {
            multi.hincrby(redisK.reqC, 'analytics', 1);
        });
        const [reqCountRes] = await multiExecAsync(client, multi => {
            multi.hgetall([config.redisNamespace, 'req:count:h'].join(':'));
        });
        const reqCount = mapProperties(reqCountRes || {}, value => parseInt(value));
        const analytics = {reqCount};
        if (/(Mobile)/.test(ctx.get('user-agent'))) {
            ctx.body = h.page({
                title: 'relist',
                heading: 'Analytics',
                content: [{
                    name: 'pre',
                    content: JSON.stringify(analytics, null, 2)}
                ],
                footerLink: 'https://github.com/evanx/relist'
            });
        } else {
            ctx.body = analytics;
        }
    });
    while (true) {
        logger.debug('spop', redisK.popS);
        const sha = await client.brpoplpushAsync(redisK.reqQ, redisK.busyQ, config.popTimeout);
        logger.debug('sha', {sha});
        if (!sha) {
            await Promise.delay(config.popDelay);
            continue;
        }
        if (sha === 'exit') {
            await multiExecAsync(client, multi => {
                multi.lrem(redisK.busyQ, 1, sha);
            });
            break;
        }
        try {
            const [hashes] = await multiExecAsync(client, multi => {
                multi.hgetall(redisK.reqH(sha));
                multi.hincrby(redisK.reqC, 'pop', 1);
            });
            logger.debug({sha, hashes});
            asserto({hashes});
            const {text} = hashes;
            asserto({text});
            const payload = {
                channel: config.slackChannel,
                username: config.slackUsername,
                icon_emoji: [':', config.slackIcon, ':'].join(''),
                text
            };
            logger.debug({payload});
            const req = {
                url: config.slackUrl,
                method: 'POST',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded'
                },
                body: 'payload=' + JSON.stringify(payload).replace(/"/g, '\'')
            };
            logger.debug('post', req);
            const fetchRes = await fetch(req.url, req);
            if (fetchRes.status !== 200) {
                throw new DataError(`Status ${fetchRes.status}`, payload);
            }
            const resText = await fetchRes.text();
            logger.debug(resText);
            await multiExecAsync(client, multi => {
                multi.hincrby(redisK.reqC, 'ok', 1);
                multi.lrem(redisK.busyQ, 1, sha);
            });
        } catch (err) {
            logger.error(err);
            await multiExecAsync(client, multi => {
                multi.hincrby(redisK.reqC, 'error', 1);
                multi.lrem(redisK.busyQ, 1, sha);
            });
        }
    }
    logger.debug('done');
    return false;
}
