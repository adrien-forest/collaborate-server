module.exports = errorHandler;

function errorHandler(err, req, res, next) {
    // custom application error
    if (typeof (err) === 'string') {
        return res.status(400).json({ message: err });
    }

    // jwt authentication error
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    // default to 500 server error
    const isProd = process.env.NODE_ENV === 'production';
    return res.status(500).json({
        error: isProd ? err : err.stack,
        message: err.message
    });
}
