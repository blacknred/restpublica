/* eslint-disable no-throw-literal */

const ms = require('ms');
const Redis = require('ioredis');
const Promise = require('bluebird');
const Limiter = require('ratelimiter');
const debug = require('debug')('gateway:Auth');

const hosts = require('../conf');
const { genApiSecret } = require('./local');
const { request } = require('../routes/_helpers');

const MAX_REQUESTS_COUNT = process.env.MAX_REQUESTS_COUNT || 40;

/* Get max requests count */
const getMaxRequestsCount = async (ctx) => {
    const apiKey = ctx.headers.api_key || null;
    const apiSecret = ctx.headers.api_secret || null;
    if (apiKey && apiSecret) {
        // check api secret
        try {
            if (apiSecret !== genApiSecret(apiKey)) throw new Error();
        } catch (e) {
            ctx.throw(401, 'Invalid API secret token');
        }
        // check api_key and domain in partners service
        try {
            ctx.state.method = 'POST';
            ctx.state.body = {
                api_key: apiKey,
                domain: ctx.request.origin
            };
            const res = await request({
                ctx, host: hosts.PARTNERS_API, url: '/apps/check', r: true
            });
            const newLimit = parseInt(res.data.limit, 10);
            if (isNaN(newLimit)) throw new Error();
            return newLimit;
        } catch (err) {
            ctx.throw(401, 'Invalid API key');
        }
    }
    return MAX_REQUESTS_COUNT;
};

/* Implement rate-limiting */
const rateLimiting = async (ctx, next) => {
    const opts = {
        db: new Redis({
            port: 6379,
            host: 'redis-cache',
            password: process.env.REDIS_PASSWORD,
        }),
        duration: 60000,
        id: ctx.ip,
        max: await getMaxRequestsCount(ctx)
    };

    // initialize limiter
    const limiter = new Limiter(opts);
    limiter.get = Promise.promisify(limiter.get);

    try {
        // check limit
        const limit = await limiter.get();

        // headers
        ctx.set('X-RateLimit-Limit', limit.total);
        ctx.set('X-RateLimit-Remaining', limit.remaining - 1);
        ctx.set('X-RateLimit-Reset', limit.reset);

        debug('remaining %s/%s %s', limit.remaining - 1, limit.total, opts.id);

        // max is reached
        if (!limit.remaining) {
            const delta = (limit.reset * 1000) - Date.now() || 0;
            const after = limit.reset - (Date.now() / 1000) || 0;
            ctx.set('Retry-After', after);

            const message = `Rate limit exceeded, retry in ${ms(delta,
                { long: true })} or change API plan.`;
            throw { status: 429, message };
        }
    } catch (e) {
        ctx.throw(e.status || 500, e.message);
    }

    await next();
};

/* Authenticate consumer and set ctx.state.consumer */
const authentication = async (ctx, next) => {
    if (process.env.NODE_ENV === 'test') {
        ctx.state.consumer = 1;
        await next();
    }
    // set success non authorised request flag
    ctx.state.consumer = 0;
    if (ctx.headers.authorization) {
        // user auth: check user id from users-api
        // and set ctx.state.consumer if ok
        const userToken = ctx.headers.authorization.split(' ')[1];
        if (!userToken) await next();
        ctx.state.method = 'GET';
        ctx.state.userAuthToken = userToken;
        const res = await request({
            ctx, host: hosts.USERS_API, url: '/users/check', r: true
        });
        const consumerId = parseInt(res.data.id, 10);
        if (isNaN(consumerId)) return;
        ctx.state.consumer = consumerId;
        delete ctx.state.method;
    }
    await next();
};

/* Restrict non authorised requests on secure API endpoints */
const auth = async (ctx, next) => {
    if (ctx.state.consumer === 0) ctx.throw(401, 'Please log in');
    await next();
};

/* Check admin for administration endpoints */
const admin = async (ctx, next) => {
    ctx.state.method = 'GET';
    const res = await request({
        ctx, host: hosts.USERS_API, url: '/users/check', r: true
    });
    if (!res.data.admin) ctx.throw(401, 'Access is restricted');
    delete ctx.state.method;
    await next();
};

module.exports = {
    auth,
    admin,
    authentication,
    rateLimiting
};
