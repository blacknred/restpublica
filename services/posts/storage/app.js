/* eslint-disable consistent-return */

const fs = require('fs');
const Koa = require('koa');
const path = require('path');
const util = require('util');
const serve = require('koa-static');
const koaBody = require('koa-body');
const logger = require('koa-logger');
const helpers = require('./_helpers');

const mkdir = util.promisify(fs.mkdir);

const app = new Koa();

/* logs */
app.use(logger());

/* errors */
app.use(async (ctx, next) => {
    try {
        await next();
        const status = ctx.status || 404;
        if (status === 404) ctx.throw(404, 'File Not Found');
    } catch (err) {
        ctx.status = err.status || 500;
        ctx.body = {
            status: 'error',
            message: err.message
        };
    }
});

/* serve static files */
app.use(serve(path.join(__dirname, '/static')));

/* multipart */
app.use(koaBody({ multipart: true }));

/* router */
app.use(async (ctx, next) => {
    /* eslint-disable no-case-declarations */
    switch (ctx.method) {
        case 'POST':
            const response = [];
            const dir = Math.random().toString(36).slice(2);
            const fullPath = path.join(__dirname, 'static', dir);
            const files = Object.values(ctx.request.body.files || {});
            try {
                await mkdir(fullPath);
                files.forEach(async (file) => {
                    const type = file.type.split('/')[0];
                    // process file
                    let fileName;
                    switch (type) {
                        case 'video':
                            fileName = `${Math.random().toString(36).slice(2)}.mp4`;
                            await helpers.videoToMp4(file.path, path.join(fullPath, fileName));
                            break;
                        case 'image':
                            fileName = Math.random().toString(36).slice(2)
                                + path.extname(file.name);
                            await helpers.imageToJpg(file.path, path.join(fullPath, fileName));
                            // const buf = await fs.createReadStream(file.path);
                            // await buf.pipe(fs.createWriteStream(path.join(fullPath, fileName)));
                            break;
                        default:
                    }
                    console.log('uploading %s -> %s', file.name, fileName);
                    response.push(`http://localhost:3007/${dir}/${fileName}`); // ctx.request.URL

                    // process thumbnail
                    const thumbName = `${Math.random().toString(36).slice(2)}.jpg`;
                    const thumbPath = path.join(fullPath, thumbName);
                    switch (type) {
                        case 'image': await helpers.imageThumb(file.path, thumbPath); break;
                        case 'video': await helpers.videoThumb(file.path, fullPath); break;
                        default:
                    }
                    response.push(`http://localhost:3007/${dir}/${thumbName}`); // ctx.request.URL
                });
                ctx.body = {
                    status: 'success',
                    data: response
                };
            } catch (err) {
                ctx.throw(500, err.message);
            }
            break;
        case 'DELETE':
            const filePath = path.join(__dirname, 'static', ctx.path);
            try {
                await fs.unlinkSync(filePath);
                console.log('deleting %s from %s', ctx.path, filePath);
                ctx.body = {
                    status: 'success',
                    data: ctx.path
                };
            } catch (err) {
                ctx.throw(500, err.message);
            }
            break;
        default: await next();
    }
});

module.exports = app;