const faker = require('faker');
const helpers = require('../_helpers');

const createSubscription = (knex, id, subId) => {
    return knex('users_subscriptions')
        .insert({
            user_id: id,
            sub_user_id: subId,
            created_at: faker.date.past(),
        })
        .catch(err => console.log(err));
};

exports.seed = (knex, Promise) => {
    return knex('users_subscriptions')
        .del()
        .then(() => {
            return knex('users')
                .count('id')
                .first();
        })
        .then(({ count }) => {
            const records = [];
            if (process.env.NODE_ENV === 'test') {
                records.push(createSubscription(knex, 1, 2));
            } else {
                for (let i = 1; i < count; i++) {
                    const subUsersLength = Math.floor(Math.random() * count) + 1;
                    const subUsers = helpers.genUniqueNumbersArr(subUsersLength, count);
                    subUsers.forEach(userId => records.push(createSubscription(knex, i, userId)));
                }
            }
            return Promise.all(records);
        })
        .catch(err => console.log(err));
};
