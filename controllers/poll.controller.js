const express = require('express');
const router = express.Router();
const pollService = require('../services/poll.service');

// routes
router.get('/', getAll);
router.get('/:id', getById);
router.post('/', create)
router.put('/:id', vote);
router.delete('/:id', _delete);

module.exports = router;

function getUser(req) {
    return {
        ...req.user,
        ip: req.ip
    };
}

function getAll(req, res, next) {
    pollService.getAll(getUser(req))
        .then(polls => polls ? res.json(polls) : res.sendStatus(400))
        .catch(err => next(err));
}

function getById(req, res, next) {
    pollService.getById(getUser(req), req.params.id)
        .then(poll => poll ? res.json(poll) : res.sendStatus(400))
        .catch(err => next(err));
}

function create(req, res, next) {
    const { body, io } = req;
    pollService.create(getUser(req), body)
        .then(poll => {
            res.json(poll);
            io.in('polls').emit('message', { type: 'created', data: poll });
        })
        .catch(err => next(err));
}

function vote(req, res, next) {
    const { params: { id }, io, body } = req;
    pollService.vote(getUser(req), id, body)
        .then(poll => {
            if (poll) {
                res.sendStatus(200);
                io.in('polls').in('poll' + id).emit('message', { type: 'updated', data: poll });
            } else {
                res.sendStatus(304);
            }
        })
        .catch(err => next(err));
}

function _delete(req, res, next) {
    const { params: { id }, io } = req;
    pollService._delete(getUser(req), id)
        .then(success => {
            if (success) {
                res.sendStatus(204);
                io.in('polls').in('poll' + id).emit('message', { type: 'deleted', data: id });
            } else {
                res.sendStatus(304);
            }
        })
        .catch(err => next(err));
}
