const config = require('../config.json');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../helpers/db');
const WrongParamsError = require('../errors/WrongParamsError');
const User = db.User;

module.exports = {
    authenticate,
    getById,
    getByUsername,
    create
};

async function authenticate({ username, password }) {
    const user = await getByUsername(username);

    if (user && bcrypt.compareSync(password, user.hash)) {
        const token = jwt.sign({ id: user._id, username }, process.env.SECRET || config.secret);
        delete user.hash;

        return {
            user,
            token
        };
    }

    throw 'Username or password is incorrect';
}

async function getById(id) {
    return await new Promise((resolve, reject) => {
        User.findOne({ _id: id }, { hash: 0 }, (err, doc) => {
            if (err) reject(err);
            resolve(doc);
        });
    })
}

async function getByUsername(username) {
    return await new Promise((resolve, reject) => {
        User.findOne({ username }, (err, doc) => {
            if (err) reject(err);
            resolve(doc);
        })
    })
}

async function create(userParam) {
    // validate
    if (!userParam || !userParam.username || !userParam.password) {
        throw new WrongParamsError('Wrong parameters');
    }

    if (await getByUsername(userParam.username)) {
        throw 'Username "' + userParam.username + '" is already taken';
    }

    const userModel = {
        username: userParam.username,
        hash: bcrypt.hashSync(userParam.password, 10)
    };

    // save user
    await new Promise((resolve, reject) => {
        User.insert(userModel, (err, doc) => {
            if (err) reject(err);
            resolve(doc);
        })
    });

    // authenticate directly
    return authenticate(userParam);
}
