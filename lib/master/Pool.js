
var Worker = require('./WorkerControl');

function Pool(options) {
    this.size = options.size || 2;
    this.spawnWorkerDelay = options.spawnWorkerDelay || 0;
    this.phantomjsOptions = options.phantomjsOptions || []; // TODO
    this.verbose = options.verbose || false;

    if (!options.workerFile) {
        throw new Error('workerFile in options expected.');
    }
    this.workerFile = options.workerFile;

    this.jobCallback = options.jobCallback;
    if (!options.jobCallback) {
        throw new Error('jobCallback in options expected.');
    }

    this.workers = [];

    if (this.verbose) {
        console.log('Spawning workers');
    }
    this.spawnWorkers();
}

// Adds workers until the pool size is reached
Pool.prototype.spawnWorkers = function () {
    var that = this;
    if (this.size > this.workers.length) {
        this.addWorker();
        setTimeout(function () {
            that.spawnWorkers();
        }, this.spawnWorkerDelay);
    }
};

// adds one worker to the pool
Pool.prototype.addWorker = function () {
    if (this.verbose) {
        console.log('Creating worker #' + this.workers.length);
    }
    this.workers.push(Worker.create(this));
};

Pool.prototype.getJob = function(jobCallback) {
    this.jobCallback(jobCallback);
};

module.exports = Pool;