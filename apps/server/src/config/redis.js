// redis client setup
// an in-memory key-value store. we use it to
// 1. Save the board state - so new users can see the current board state when they join
// 2. Later: pub/sub so multiple server instances can talk to each other

const { createClient } = require('redis');;

async function createRedisClient () {
    const client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    // Redis client emits and error event if connection drops
    // if this isnt handled, node.js will crahs the entire server
    client.on('error', (err) => {
        console.error('Redis Client Error', err.message);
    });
    await client.connect();
    return client;
}

module.exports = {
    createRedisClient
};