const unless = require('express-unless');
const UnauthorizedError = require('../errors/UnauthorizedError');

module.exports = auth;

function auth() {
    return goThroughMiddleware.unless({
        path: [
            // public routes that don't require authentication
            '/users/authenticate',
            '/users/register',
            { url: /\/polls(\/)?/g }
        ]
    }); 
}

const goThroughMiddleware = (req, res, next) => {
    if (!req.user) {
        throw new UnauthorizedError();
    }
    next();
};

goThroughMiddleware.unless = unless;
