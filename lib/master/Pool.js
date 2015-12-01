
var Worker = require('./WorkerControl');
var fs = require('fs');

function Pool(options) {
    this.size = options.numWorkers || 2;
    this.spawnWorkerDelay = options.spawnWorkerDelay || 0;
    this.phantomjsOptions = options.phantomjsOptions || [];
    this.verbose = options.verbose || false;
    this.workerTimeout = options.workerTimeout || 120 * 1000;

    this.jobIndex = 0;

    if (options.phantomjsBinary) {
        this.phantomjsBinary = options.phantomjsBinary;
    } else {
        // Check if PhantomJS is installed
        var phantomjsLib;
        try {
            phantomjsLib = require('phantomjs');
        } catch (e) {} // Do nothing, we were just checking
        try {
            phantomjsLib = require('phantomjs2');
        } catch (e) {}

        if (phantomjsLib) {
            this.phantomjsBinary = phantomjsLib.path;
        } else {
            throw new Error('PhantomJS binary not found. Use the option phantomjsBinary or install phantomjs via npm.');
        }
    }

    if (!options.workerFile) {
        throw new Error('workerFile in options expected.');
    }
    this.workerFile = options.workerFile;

    this.jobCallback = options.jobCallback;
    if (!options.jobCallback) {
        throw new Error('jobCallback in options expected.');
    }

    this.workers = [];
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

Pool.prototype.getJob = function(jobCallback, workerData) {
    this.jobCallback(jobCallback, workerData, this.jobIndex);
    this.jobIndex++;
};

Pool.prototype.start = function () {
    if (this.verbose) {
        console.log('Starting spawning workers');
    }
    this.spawnWorkers();
};

module.exports = Pool;