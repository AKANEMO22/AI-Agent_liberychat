const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  try {
    const mongod = await MongoMemoryServer.create({
      instance: {
        port: 27017,
        dbName: 'LibreChat',
      },
    });
    console.log('MongoMemoryServer running at:', mongod.getUri());
    // Keep alive
    setInterval(() => {}, 1000 * 60 * 60);
  } catch (err) {
    console.error('MongoMemoryServer error:', err);
    process.exit(1);
  }
})();
