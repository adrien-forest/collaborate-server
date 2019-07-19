const Datastore = require('nedb');

module.exports = {
    User: new Datastore({ filename: 'dbs/users.db', autoload: true }),
    Poll: new Datastore({ filename: 'dbs/polls.db', autoload: true })
};
