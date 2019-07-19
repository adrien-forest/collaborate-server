require('rootpath')();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('helpers/jwt');
const auth = require('helpers/auth');
const errorHandler = require('helpers/error-handler');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

// use JWT auth to secure the api
app.use(jwt());
app.use(auth());

// socket-io middleware
let io;
app.use((req, res, next) => {
    req.io = io;
    next();
});

// api routes
app.use('/users', require('./controllers/user.controller'));
app.use('/polls', require('./controllers/poll.controller'));

// global error handler
app.use(errorHandler);

// start server
const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 4000;
const server = app.listen(port, function () {
    console.log('Server listening on port ' + port);
});

// initialize socket-io
io = require('socket.io').listen(server);

io.on('connection', function(client) {
    client.on('room', room => client.join(room));
    client.on('leave', room => client.leave(room));
});
