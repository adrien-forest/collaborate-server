const WrongParamsError = require('../errors/WrongParamsError');
const UnauthorizedError = require('../errors/UnauthorizedError');
const db = require('../helpers/db');
const Poll = db.Poll;

module.exports = {
    getAll,
    getById,
    create,
    vote,
    _delete
};

function createPromise(func, ctx, ...args) {
    return new Promise((resolve, reject) => {
        func.call(ctx, ...args, (err, doc, affected) => {
            if (err) reject(err);
            if (!affected) {
                resolve(doc);
            }
            resolve([doc, affected]);
        })
    });
}

function preparePoll(user, poll) {
    if (!user) user = {};
    const { votes, protection, createdBy } = poll;
    const protections = { 'IP': 'ip', 'AUTHENTICATED': 'username' };
    const checkField = protections[protection];

    // add 'voted' field if user had voted on this poll
    if (checkField) {
        const voteIndex = votes.findIndex(entry => entry[checkField] === user[checkField]);
        if (voteIndex > -1) {
            poll.voted = votes[voteIndex].v;
        }
    }

    // add 'owns' field is user created the current poll
    if ([user.username, user.ip].includes(createdBy)) {
        poll.owns = true;
    }
    delete poll.createdBy;

    // group votes per card
    const groupedVotes = votes.reduce((acc, obj) => {
        const vote = checkField ? obj.v : obj;
        if (!acc[vote]) {
            acc[vote] = 0;
        }
        acc[vote] += 1;
        return acc;
    }, {});

    poll.votesCount = votes.length;

    poll.votes = Object.keys(groupedVotes)
        .map(key => ({ card: key, count: groupedVotes[key] }))
        .sort((a, b) => b.count - a.count);

    return poll;
}

async function getAll(user) {
    const polls = await createPromise(Poll.find, Poll, {});
    polls.forEach(poll => preparePoll(user, poll));
    return polls;
}

async function getById(user, id) {
    const poll = await createPromise(Poll.findOne, Poll, { _id: id });
    if (poll) {
        return preparePoll(user, poll);
    }
}

async function create(user, pollParams) {
    const { title, description, deck, protection } = pollParams;
    if (!title || !deck || !deck.length || !user || !['NONE', 'IP', 'AUTHENTICATED'].includes(protection)) {
        throw new WrongParamsError('Incorrect or missing parameters');
    }

    const pollModel = {
        title,
        description,
        deck: deck.map(card => '' + card),
        protection,
        createdAt: Date.now(),
        createdBy: user.username || user.ip,
        votes: []
    };

    return await createPromise(Poll.insert, Poll, pollModel);
}

async function vote(user, pollId, params) {
    if (!pollId || !params || !params.vote) {
        throw new WrongParamsError();
    }

    const poll = await createPromise(Poll.findOne, Poll, { _id: pollId });

    if (!poll) return;

    const vote = params.vote;
    if (!poll.deck.includes(vote)) {
        throw new WrongParamsError('Incorrect vote option');
    }

    const protections = { 'IP': 'ip', 'AUTHENTICATED': 'username' };
    const checkField = protections[poll.protection];
    const votes = poll.votes;
    let edited = false;

    // if we have either a IP or user based vote protection
    if (checkField) {
        if (!user[checkField]) throw new UnauthorizedError();

        // check if user already voted
        // if so, replace already existing vote with new vote
        const voteIdx = votes.findIndex(entry => entry[checkField] === user[checkField]);
        if (voteIdx > -1) {
            votes[voteIdx].v = vote;
            edited = true;
        }
    }

    if (!edited) {
        if (checkField) {
            votes.push({
                v: vote,
                [checkField]: user[checkField]
            });
        } else {
            votes.push(vote);
        }
    }
    
    const [doc, affected] = await createPromise(
        Poll.update,
        Poll,
        { _id: pollId },
        { $set: { votes } },
        { returnUpdatedDocs: true }
    );

    return preparePoll(user, affected);
}

async function _delete(user, id) {
    if (!user) return;
    
    const res = await createPromise(
        Poll.remove,
        Poll,
        {
            _id: id,
            createdBy: { $in: [ user.username, user.ip ] }
        }
    );

    return res > 0;
}
