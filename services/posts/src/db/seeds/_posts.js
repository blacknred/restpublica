const faker = require('faker');
const helpers = require('../_helpers');

const isTest = process.env.NODE_ENV === 'test';
let tags;

const createTagMapping = (knex, id, postId) => {
    return knex('posts_tags')
        .insert({
            tag_id: id,
            post_id: postId
        })
        .catch(err => console.log(err));
};

const createPost = (knex, i) => {
    const isTagged = Math.random() >= 0.5;
    let tagsIndexes;
    const post = {
        slug: helpers.genSlug(),
        author_id: Math.floor(Math.random() * (isTest ? 3 : 40)) + 1,
        type: 'file',
        description: faker.lorem.sentences(),
        views_cnt: Math.floor(Math.random() * (isTest ? 30 : 500)) + 1,
        created_at: faker.date.past()
    };
    if (i % 3 === 0) {
        post.community_id = Math.floor(Math.random() * (isTest ? 2 : 10)) + 1;
    }

    // if with tags
    if (isTagged) {
        const tagsCount = Math.floor(Math.random() * (3)) + 1;
        tagsIndexes = helpers.genUniqueNumbersArr(tagsCount, tags.length);
        post.description += ' ';
        post.description += tagsIndexes.map(index => `#${tags[index - 1]}`).join(' ');
        // console.log(i, tagsCount, tagsIndexes, post.description);
    }
    return knex('posts')
        .insert(post)
        .then(() => {
            const records = [];
            if (isTagged) {
                tagsIndexes.forEach(index => records.push(createTagMapping(knex, index, i)));
            }
            return Promise.all(records);
        })
        .catch(err => console.log(err));
};

exports.seed = (knex, Promise) => {
    return knex('posts')
        .del()
        .then(() => knex('tags').select('*'))
        .then((tgs) => {
            tags = tgs.map(tag => tag.title);
            // console.log(tags);
            const records = [];
            for (let i = 1; i <= (isTest ? 10 : 500); i++) {
                records.push(createPost(knex, i));
            }
            return Promise.all(records);
        })
        .catch(err => console.log(err));
};
