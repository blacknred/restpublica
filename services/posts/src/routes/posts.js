/* eslint-disable consistent-return */
/* eslint-disable no-throw-literal */
/* eslint-disable no-case-declarations */

const express = require('express');
const mime = require('mime-types');

const Tag = require('../db/models/Tag');
const Post = require('../db/models/Post');
const { posts } = require('./validation');
const dbHelpers = require('../db/_helpers');
const { ensureAuthenticated } = require('../auth');

const router = express.Router();

/* posts */

router
    .post('/', ensureAuthenticated, posts, async (req, res, next) => {
        const newPost = {
            slug: dbHelpers.genSlug(),
            author_id: req.user,
            type: req.body.type,
            community_id: req.body.communityId || null,
            commentable: req.body.commentable,
            archived: req.body.archived,
            description: req.body.description
        };
        try {
            const post = await Post.create(newPost);
            switch (req.body.type) {
                case 'file':
                    req.body.files.forEach(async (file) => {
                        await Post.addFiles({
                            post_id: post[0].id,
                            mime: mime.lookup(file.file),
                            file: file.file,
                            thumb: file.thumb
                        });
                    });
                    break;
                case 'link':
                    const newLink = {
                        post_id: post[0].id,
                        link: req.body.link,
                        type: req.body.linkType,
                        src: req.body.linkSrc,
                        title: req.body.linkTitle || null,
                        description: req.body.linkDescription || null,
                        img: req.body.linkImg || null
                    };
                    await Post.addLink(newLink);
                    break;
                case 'poll':
                    req.body.pollAnswers.forEach(async (ans) => {
                        const newPollOption = {
                            post_id: post[0].id,
                            text: ans.text,
                            img: ans.img || null,
                            thumb: ans.thumb || null,
                            ends_at: req.body.pollEndsAt || null
                        };
                        await Post.addPollOption(newPollOption);
                    });
                    break;
                case 'repost':
                    const repostObj = {
                        post_id: post[0].id,
                        reposted_id: req.body.repostedId
                    };
                    await Post.addRepost(repostObj);
                    break;
                default:
            }
            const wordsInDescription = req.body.description.trim().split(' ');
            wordsInDescription.forEach(async (word) => {
                if (word.charAt(0) === '#') {
                    const tagId = await Tag.create(word.substr(1));
                    await Tag.addOneToPost(tagId, post[0].id);
                }
            });
            res.status(200).json({ status: 'success', data: post[0] });
        } catch (err) {
            return next(err);
        }
    })
    .get('/', posts, async (req, res, next) => {
        const offset = req.query.offset && /^\+?\d+$/.test(req.query.offset) ?
            --req.query.offset : 0;
        const tag = req.query.tag ? req.query.tag.toLowerCase() : null;
        const query = req.query.q ? req.query.q.toLowerCase() : null;
        const profile = req.query.profile || null;
        const community = req.query.community || null;
        const profiles = req.query.profiles ? req.query.profiles.split(',') : null;
        const communities = req.query.communities ? req.query.communities.split(',') : null;
        const mode = req.query.mode || null;
        const feed = req.query.feed || null;
        const reduced = req.useragent.isMobile || req.query.reduced;
        let data;
        try {
            if (query) {
                data = await Post.getAllSearched({
                    query, userId: req.user, offset, reduced
                });
            } else if (tag) {
                data = await Post.getAllByTag({
                    tag, userId: req.user, offset, reduced
                });
            } else if (profile) {
                switch (mode) {
                    case 'count': data = await Post.getAllCountByProfile(profile, req.user); break;
                    default: data = await Post.getAllByProfile(
                        { profileId: profile, userId: req.user, offset, reduced });
                }
            } else if (community) {
                switch (mode) {
                    case 'count': data = await Post.getAllCountByCommunity(community); break;
                    default: data = await Post.getAllByCommunity(
                        { communityId: community, userId: req.user, offset, reduced });
                }
            } else if (feed) {
                data = await Post.getAllFeed(
                    { profiles, communities, userId: req.user, offset, reduced });
            } else data = await Post.getAllTrending({ userId: req.user, offset, reduced });
            res.status(200).json({ status: 'success', data });
        } catch (err) {
            return next(err);
        }
    })
    .get('/:slug', posts, async (req, res, next) => {
        try {
            const data = await Post.getOne(req.params.slug, req.user);
            if (!data) throw { status: 404, message: 'Post not found' };
            const updatedValue = { views_cnt: parseInt(data.views_cnt, 10) + 1 };
            await Post.update({ updatedValue, postId: data.id, userId: req.user });
            res.json({ status: 'success', data });
        } catch (err) {
            return next(err);
        }
    })
    .put('/:pid', ensureAuthenticated, posts, async (req, res, next) => {
        const updatedValue = { [req.body.option]: req.body.value };
        try {
            const post = await Post.isExists(req.params.pid);
            if (!post) throw { status: 404, message: 'Post not found' };
            if (post.author_id !== req.user) throw { status: 403, message: 'Permission denied' };
            const data = await Post.update({
                updatedValue, postId: req.params.pid, userId: req.user
            });
            if (updatedValue.description) {
                const wordsInDescription = req.body.value.trim().split(' ');
                wordsInDescription.forEach(async (word) => {
                    if (word.charAt(0) === '#') {
                        const tagId = await Tag.create(word.substr(1));
                        await Tag.addOneToPost(tagId, req.params.pid);
                    }
                });
            }
            res.status(200).json({ status: 'success', data: { [req.body.option]: data } });
        } catch (err) {
            return next(err);
        }
    })
    .delete('/:pid', ensureAuthenticated, posts, async (req, res, next) => {
        try {
            const post = await Post.isExists(req.params.pid);
            if (!post) throw { status: 404, message: 'Post not found' };
            if (post.author_id !== req.user) throw { status: 403, message: 'Permission denied' };
            const filesToDelete = await Post.deleteOne(req.params.pid, req.user);
            const data = { id: req.params.pid, filesToDelete };
            res.status(200).json({ status: 'success', data });
        } catch (err) {
            return next(err);
        }
    });

module.exports = router;
