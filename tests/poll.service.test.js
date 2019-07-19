const Datastore = require('nedb');
const WrongParamsError = require('../errors/WrongParamsError');
const UnauthorizedError = require('../errors/UnauthorizedError');
const fs = require('fs');
const proxyquire = require('proxyquire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.should();

const DBPath = './tests/polls-test.db';
const pollStub = { Poll: new Datastore({ filename: DBPath, autoload: true }) };
const pollService = proxyquire('../services/poll.service', {
    '../helpers/db': pollStub
});

describe('Poll Service', () => {

    before((done) => {
        pollStub.Poll.remove({}, { multi: true }, done);
    });

    after(() => {
        try {
            fs.unlinkSync(DBPath);
        } catch (e) {}
    });

    describe('Empty database', () => {
        it('should return an empty list', async () => {
            const polls = await pollService.getAll();
            expect(polls).to.be.a('array');
            expect(polls).to.have.lengthOf(0);
        });

        it('should return undefined for a non existing poll id', async () => {
            const poll = await pollService.getById('azerty');
            expect(poll).to.be.undefined;
        });
    });

    let pollId;
    describe('Creating a poll', () => {

        const user = {
            username: 'adrien'
        };

        let data;
        beforeEach(() => {
            data = {
                title: 'title',
                description: 'desc',
                deck: [1, 2, 3],
                protection: 'NONE'
            };
        })

        it('should reject when creating a poll without title', async () => {
            delete data.title;
            await expect(pollService.create(user, data)).to.be.rejectedWith(WrongParamsError);
        });

        it('should reject when creating a poll without user obj', async () => {
            await expect(pollService.create(null, data)).to.be.rejectedWith(WrongParamsError);
        });

        it('should reject when creating a poll with an empty deck or without deck', async () => {
            data.deck = [];
            await expect(pollService.create(user, data)).to.be.rejectedWith(WrongParamsError);
            delete data.deck;
            await expect(pollService.create(user, data)).to.be.rejectedWith(WrongParamsError);
        });

        it('should reject when creating a poll without protection or valid protection', async () => {
            data.protection = 'UNKNOWN';
            await expect(pollService.create(user, data)).to.be.rejectedWith(WrongParamsError);
            delete data.protection;
            await expect(pollService.create(user, data)).to.be.rejectedWith(WrongParamsError);
        });

        it('should create a poll with an _id key', async () => {
            const poll = await pollService.create(user, data);
            poll.should.have.property('_id');
            poll.should.deep.include({
                title: data.title,
                description: data.description,
                protection: data.protection,
                deck: data.deck.map(card => '' + card)
            });
            pollId = poll._id;
        });

        it('should be the only poll when getting all the polls', async () => {
            const polls = await pollService.getAll(user);
            polls.should.have.lengthOf(1);
            polls[0].should.include({ '_id': pollId });
        });

        it('should have 3 polls after creating two more', async () => {
            await pollService.create(user, data);
            await pollService.create(user, data);
            const polls = await pollService.getAll(user);
            polls.should.have.lengthOf(3);
        });

    });

    describe('Getting a poll by id', () => {

        before(() => {
            pollId.should.exist;
        });

        it('should return the poll associated with this id', async () => {
            const poll = await pollService.getById(null, pollId);
            poll.should.include({ '_id': pollId });
        });

        it('should not have the owns key for an unknown user/wrong user', async () => {
            const user = {};
            let poll = await pollService.getById(user, pollId);
            poll.should.not.include.key('owns');
            user.username = 'nobody';
            poll = await pollService.getById(user, pollId);
            poll.should.not.include.key('owns');
        });

        it('should have the owns key for the appropriated user', async () => {
            const user = {
                username: "adrien"
            };
            const poll = await pollService.getById(user, pollId);
            poll.should.include({ 'owns': true });
        });

    });

    describe('Poll IP-protected flow', () => {
        let pollId;

        it('should create a poll for user adrien with ip protection', async () => {
            const user = { username: 'adrien' };
            const pollData = {
                title: 'test',
                deck: [1, 2, 3, 4],
                protection: 'IP'
            };
            const poll = await pollService.create(user, pollData);
            poll.should.include.key('_id');
            pollId = poll._id;
        });

        describe('Tests', () => {

            before(() => {
                pollId.should.exist;
            })

            it('should not allow user to vote on the poll with non existing deck card', async () => {
                const user = { username: 'adrien' };
                const vote = { vote: 'D' };
                await expect(pollService.vote(user, pollId, vote)).to.be.rejectedWith(WrongParamsError);
            });

            it('should not allow user to vote if no user ip set', async () => {
                const user = { username: 'adrien' };
                const vote = { vote: '1' };
                await expect(pollService.vote(user, pollId, vote)).to.be.rejectedWith(UnauthorizedError);
            });

            it('should update poll correctly when voting with correct params', async () => {
                const user = { username: 'adrien', ip: '192.168.0.20' };
                const vote = { vote: '1' };
                const poll = await pollService.vote(user, pollId, vote);
                poll.should.include({ '_id': pollId });
                poll.should.include.key('owns');
                poll.votesCount.should.equal(1);
                poll.votes.should.have.lengthOf(1);
                poll.votes[0].should.eql({ card: '1', count: 1 });
            });

            it('should change vote option if same user votes again', async () => {
                const user = { ip: '192.168.0.20' };
                const vote = { vote: '2' };
                const poll = await pollService.vote(user, pollId, vote);
                poll.should.include({ '_id': pollId });
                poll.should.not.include.key('owns');
                poll.votesCount.should.equal(1);
                poll.votes.should.have.lengthOf(1);
                poll.votes[0].should.eql({ card: '2', count: 1 });
            });

            it('should not change anything if same user votes on same vote again', async () => {
                const user = { ip: '192.168.0.20' };
                const vote = { vote: '2' };
                const poll = await pollService.vote(user, pollId, vote);
                poll.should.include({ '_id': pollId });
                poll.votesCount.should.equal(1);
                poll.votes.should.have.lengthOf(1);
                poll.votes[0].should.eql({ card: '2', count: 1 });
            });

            it('should add new vote if different user vote on this poll', async () => {
                const user = { ip: '192.168.0.21' };
                const vote = { vote: '2' };
                let poll = await pollService.vote(user, pollId, vote);
                poll.should.include({ '_id': pollId });
                poll.votesCount.should.equal(2);
                poll.votes.should.have.lengthOf(1);
                poll.votes[0].should.eql({ card: '2', count: 2 });
                vote.vote = '1';
                poll = await pollService.vote(user, pollId, vote);
                poll.votesCount.should.equal(2);
                poll.votes.should.have.lengthOf(2);
                poll.votes.should.include.deep.members([
                    { card: '1', count: 1 },
                    { card: '2', count: 1 }
                ]);
            });

            it('should return DESC ordered votes (added a few extra votes)', async () => {
                const user = { ip: '192.168.0.22' };
                const vote = { vote: '3' };
                let poll = await pollService.vote(user, pollId, vote);
                user.ip = '192.168.0.23';
                vote.vote = '3';
                poll = await pollService.vote(user, pollId, vote);
                user.ip = '192.168.0.24';
                vote.vote = '2';
                poll = await pollService.vote(user, pollId, vote);
                user.ip = '192.168.0.25';
                vote.vote = '2';
                poll = await pollService.vote(user, pollId, vote);
                poll.votesCount.should.equal(6);
                poll.votes.should.have.lengthOf(3);
                poll.votes[0].should.eql({ card: '2', count: 3 });
                poll.votes[1].should.eql({ card: '3', count: 2 });
                poll.votes[2].should.eql({ card: '1', count: 1 });
            });

            it('should not delete poll if not creator tries to delete it', async () => {
                let user = { username: 'user2' };
                let deleted = await pollService._delete(user, pollId);
                deleted.should.be.false;
                user = { ip: '192.168.0.20' };
                deleted = await pollService._delete(user, pollId);
                deleted.should.be.false;
                const poll = await pollService.getById(user, pollId);
                poll.should.exist;
            });

            it('should delete poll if owner deletes it', async () => {
                let user = { username: 'adrien' };
                let deleted = await pollService._delete(user, pollId);
                deleted.should.be.true;
                const poll = await pollService.getById(user, pollId);
                expect(poll).to.be.undefined;
            });

        });

    });

    describe('Poll auth-protected flow', () => {
        let pollId;

        it('should create a poll for user adrien with auth protection', async () => {
            const user = { username: 'adrien' };
            const pollData = {
                title: 'test',
                deck: [1, 4, 8, 'King'],
                protection: 'AUTHENTICATED'
            };
            const poll = await pollService.create(user, pollData);
            poll.should.include.key('_id');
            pollId = poll._id;
        });

        describe('Tests', () => {

            before(() => {
                pollId.should.exist;
            });

            it('should not allow vote for a non auth user', async () => {
                let user = { ip: '192.168.0.20' };
                let vote = { vote: 'King' };
                await expect(pollService.vote(user, pollId, vote)).to.be.rejectedWith(UnauthorizedError);
                user = {};
                await expect(pollService.vote(user, pollId, vote)).to.be.rejectedWith(UnauthorizedError);
            });

            it('should allow vote for auth users', async () => {
                let user = { username: 'user3' };
                let vote = { vote: 'King' };
                let poll = await pollService.vote(user, pollId, vote);
                poll.votesCount.should.equal(1);
                poll.votes.should.have.lengthOf(1);
                poll.votes[0].should.eql({ card: 'King', count: 1 });
                user.username = 'user4';
                vote.vote = '4';
                poll = await pollService.vote(user, pollId, vote);
                poll.votesCount.should.equal(2);
                poll.votes.should.have.lengthOf(2);
                poll.votes[0].should.eql({ card: '4', count: 1 });
                poll.votes[1].should.eql({ card: 'King', count: 1 });
                user.username = 'adrien';
                vote.vote = '4';
                poll = await pollService.vote(user, pollId, vote);
                poll.votesCount.should.equal(3);
                poll.votes.should.have.lengthOf(2);
                poll.votes[0].should.eql({ card: '4', count: 2 });
                poll.votes[1].should.eql({ card: 'King', count: 1 });
                vote.vote = '8';
                poll = await pollService.vote(user, pollId, vote);
                poll.votesCount.should.equal(3);
                poll.votes.should.have.lengthOf(3);
                poll.votes.should.include.deep.members([
                    { card: '4', count: 1 },
                    { card: '8', count: 1 }
                ]);
                poll.votes[2].should.eql({ card: 'King', count: 1 });
            });

        });

    });

    describe('Poll no-protection flow', () => {
        let pollId;

        it('should create a poll without protection', async () => {
            const user = { ip: '192.168.0.20' };
            const pollData = {
                title: 'test',
                deck: [1, 4, 8, 10, 'King'],
                protection: 'NONE'
            };
            const poll = await pollService.create(user, pollData);
            poll.should.include.key('_id');
            pollId = poll._id;
        });

        describe('Tests', () => {

            before(() => {
                pollId.should.exist;
            });

            it('should add new votes no matter the user', async () => {
                let vote = { vote: '1' };
                let user;
                let poll = await pollService.vote(user, pollId, vote);
                poll.votesCount.should.equal(1);
                poll.votes.should.have.lengthOf(1);
                poll.votes[0].should.eql({ card: '1', count: 1 });
                poll = await pollService.vote(user, pollId, vote);
                poll.votesCount.should.equal(2);
                poll.votes.should.have.lengthOf(1);
                poll.votes[0].should.eql({ card: '1', count: 2 });
                vote.vote = '4';
                user = { username: 'adrien' };
                poll = await pollService.vote(user, pollId, vote);
                poll.votesCount.should.equal(3);
                poll.votes.should.have.lengthOf(2);
                poll.votes[0].should.eql({ card: '1', count: 2 });
                poll.votes[1].should.eql({ card: '4', count: 1 });
                vote.vote = '1';
                user = { ip: '192.168.0.20' };
                poll = await pollService.vote(user, pollId, vote);
                poll.votesCount.should.equal(4);
                poll.votes.should.have.lengthOf(2);
                poll.votes[0].should.eql({ card: '1', count: 3 });
                poll.votes[1].should.eql({ card: '4', count: 1 });
            });

            it('should not delete poll if user was not the creator of the poll', async () => {
                let user = { username: 'adrien' };
                let res = await pollService._delete(user, pollId);
                res.should.be.false;
                user = { ip: '192.168.0.21' };
                res = await pollService._delete(user, pollId);
                res.should.be.false;
                const poll = await pollService.getById(user, pollId);
                poll.should.exist;
            });

            it('should delete the poll for the creator of the poll', async () => {
                const user = { ip: '192.168.0.20' };
                const res = await pollService._delete(user, pollId);
                res.should.be.true;
                const poll = await pollService.getById(user, pollId);
                expect(poll).to.not.exist;
            });

        });

    });

});
