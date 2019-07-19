module.exports = class WrongParamsError extends Error {
    constructor(args) {
        super(args);
        this.name = 'WrongParamsError';
    }
};
