const expressJwt = require('express-jwt');
const config = require('config.json');
const userService = require('../services/user.service');

module.exports = jwt;

function jwt() {
    return expressJwt({
        secret: process.env.SECRET || config.secret,
        requestProperty: 'user',
        isRevoked,
        credentialsRequired: false
    });
}

async function isRevoked(req, payload, done) {
    const user = await userService.getById(payload.id);

    // revoke token if user no longer exists
    if (!user) {
        return done(null, true);
    }

    done();
};
