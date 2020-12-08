/* eslint func-names: ["error", "as-needed"] */

const redis = require('redis');
const commands = require('redis-commands').list;
const objectDecorator = require('./object-decorator');

const AsyncRedis = function (args) {
  let client;
  let timeout = false;
  if (Array.isArray(args)) {
    let options = args.find(arg => typeof arg === 'object');
    if (options && options.hasOwnProperty('command_timeout')) {
      timeout = options.command_timeout;
      delete options.command_timeout;
    }
    client = redis.createClient(...args);
  } else {
    client = redis.createClient(args);
  }
  return AsyncRedis.decorate(client, timeout);
};

AsyncRedis.createClient = (...args) => new AsyncRedis(args);

// this is the set of commands to NOT promisify
const commandsToSkipSet = new Set(['multi']);
// this is the set of commands to promisify
const commandSet = new Set(commands.filter(c => !commandsToSkipSet.has(c)));

AsyncRedis.decorate = (redisClient, timeout) => objectDecorator(redisClient, (name, method) => {
  if (commandSet.has(name)) {
    return (...args) => new Promise((resolve, reject) => {
      args.push((error, ...results) => {
        if (error) {
          reject(error, ...results);
        } else {
          resolve(...results);
        }
      });
      if (timeout) {
        setTimeout(() => reject(new Error('Redis command timed out')), timeout);
      }
      method.apply(redisClient, args);
    });
  }
  return method;
});

module.exports = AsyncRedis;
