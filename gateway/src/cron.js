const fs = require('fs');
const path = require('path');
const debug = require('debug')('gateway:JSCRON');

/* Js cron */

module.exports = () => {
    const tasks = fs.readdirSync(path.join(__dirname, 'tasks'));
    debug('started! Running jobs:');
    tasks.forEach((task) => {
        // eslint-disable-next-line
        const y = require(`./tasks/${task}`);
        try {
            y.start();
            console.log('%s status is %s', task, y.running);
        } catch (err) {
            debug('error! %s', err.message);
        }
    });
};

