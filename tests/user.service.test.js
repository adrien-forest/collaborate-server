const Datastore = require('nedb');
const WrongParamsError = require('../errors/WrongParamsError');
const fs = require('fs');
const proxyquire =  require('proxyquire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.should();

const DBPath = './tests/users-test.db';
const userStub = { User: new Datastore({ filename: DBPath, autoload: true }) };
const userService = proxyquire('../services/user.service', {
    '../helpers/db': userStub
});

describe('User Service', () => {

    before((done) => {
        userStub.User.remove({}, { multi: true }, done);
    });

    after(() => {
        try {
            fs.unlinkSync(DBPath);
        } catch (e) {} 
    });

    describe('Create a new user', () => {

        it('should throw when not providing right params', async () => {
            let userData;
            await expect(userService.create()).to.be.rejectedWith(WrongParamsError);
            userData = { username: 'adrien' };
            await expect(userService.create(userData)).to.be.rejectedWith(WrongParamsError);
            userData = { password: 'test' };
            await expect(userService.create(userData)).to.be.rejectedWith(WrongParamsError);
        });

        let userId;
        const userData = {
            username: 'adrien',
            password: 'test'
        };
        it('should create and return a new user \'adrien\' with a session', async () => {
            const res = await userService.create(userData);
            res.should.have.keys(['user', 'token']);
            res.user.should.have.property('_id');
            res.user.should.not.have.property('hash');
            userId = res.user._id;
        });

        it('should throw an error when trying to create an already existing user', async () => {
            const data = {
                username: 'adrien',
                password: 'testtest'
            };
            await expect(userService.create(data)).to.be.rejected;
        });

        it('should return the user for a given id', async () => {
            const user = await userService.getById(userId);
            user.should.not.have.property('hash');
            user.should.have.keys({
                '_id': userId,
                'username': userData.username
            });
        });

        it('should return the user for a given username', async () => {
            const user = await userService.getByUsername(userData.username);
            user.should.have.property('hash');
            user.should.include.keys({
                '_id': userId,
                'username': userData.username
            });
        });

    });

    describe('Authenticating', () => {

        it('should not authenticate user if wrong credentials', async () => {
            await expect(userService.authenticate()).to.be.rejected;
            const data = {
                username: 'adrien',
                password: 'testt'
            };
            await expect(userService.authenticate(data)).to.be.rejected;
            data.username = 'user2';
            await expect(userService.authenticate(data)).to.be.rejected;
            delete data.password;
            await expect(userService.authenticate(data)).to.be.rejected;
        });

        it('should authenticate the user and return a session', async () => {
            const data = {
                username: 'adrien',
                password: 'test'
            };
            const res = await userService.authenticate(data);
            res.should.have.keys(['user', 'token']);
            res.user.should.have.property('_id');
            res.user.should.not.have.property('hash');
        });

    });

});
