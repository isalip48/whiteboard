// Cors Config - Cross Origin Resource Sharing
// Browsers block requests between different domains by default. This config tells our server which origins are allowed in

const corsOptions = {
    // origin can be a string, an array or a function.
    // Here we read it from the .env 
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true, // Allow cookies to be sent in cross-origin requests
};

module.exports = {
    corsOptions,
};  