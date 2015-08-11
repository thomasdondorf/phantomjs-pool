
var cp = require('child_process');
var http = require('http');
var querystring = require('querystring');

var path = require('path');
var phantomjs = require('phantomjs');
var phantomjsBinPath = phantomjs.path;

// timeout afte which worker is restarted because something seems to be stuck
var WORKER_TIMEOUT = 120 * 1000;

var VERBOSE = false;

function log(workerId, msg) {
    if (VERBOSE) {
        console.log('#' + workerId + ' ' + msg);
    }
}

// Number of current workers, to give new workers an id
var workerId = 0;

function Worker(pool) {
    this.id = workerId;
    workerId++;
    this.pool = pool;
    this.createProcess();
    this.waitingTimeout = null;
    if (this.pool.verbose) {
        VERBOSE = true;
    }
}

// Create process of PhantomJS worker
Worker.prototype.createProcess = function() {

    // first kill the old worker process if there ist still one
    if (this.proc) {
        log(this.id, 'killing worker');
        this.proc.kill();
    }

    var that = this;
    that.port = undefined;

    var clArgs = ['lib/worker/Worker.js', this.id, this.pool.workerFile];
    // TODO: Special phantomjs arguments/options

    // Spawn process
    this.proc = cp.spawn(phantomjsBinPath, clArgs, { cwd : process.cwd() });
    this.proc.stdout.on('data', function (data) {
        // parse first data coming from the worker and interpret it as port number
        if (that.port === undefined) {
            that.port = parseInt(data);
            log(that.id, ' starting on port: ' + that.port);

            // we are now ready setup and can start working
            that.readyForWork();
        }
    });

    // This should not happen, but just in case, we log it...
    this.proc.stderr.on('data', function (data) {
        log(that.id, 'STDERR: ' + data);
    });

    // If the process is killed or closed we want to start another one
    this.proc.on('close', function (code, signal) {
        log(that.id, 'process closed');
        clearTimeout(that.waitingTimeout); // remove timeout (which checks if worker is stuck) if we have one running

        // code == 0 -> means worker closed as expected after he crawled several websites
        // (planned closing because of memory leak problems)
        if (code !== 0) {
            log(that.id, 'closed with error code ' + code + ', signal: ' + signal);
            // use callback to signal error
            that.currentJob.callback(new Error('PhantomJS error, closing signal: ' + signal));
        }
        that.proc = null; // there is no process anymore attached to this worker

        // restart process
        log(that.id, 'recreating phantomjs instance');
        that.createProcess();
    });

};


// called when the worker has no job and is ready to receive work
Worker.prototype.readyForWork = function() {
    if (this.currentJob) {
        log(this.id, 'ignoring the last job: ' + JSON.stringify(this.currentJob.data));
        return;
    }

    var that = this;
    this.pool.getJob(function (data, doneCallback) {
        that.work(data, doneCallback);
    });
};

// called by master -> contains a new job and a callback that should be called when the job is done or erroneous
Worker.prototype.work = function(data, jobCallback) {
    var that = this;
    that.currentJob = {
        data : data,
        callback : jobCallback
    };
    log(this.id, 'new job ' + JSON.stringify(data) + ' / ' + (new Date()).toString());


    // we will now send this job the the phantomJS instance via REST
    // the phantomJS instance has a port opened for this which accepts REST calls

    // The data we want to submit via POST
    var postData = querystring.stringify({
        data : JSON.stringify(data)
    });

    // parameters for the request
    var options = {
        hostname: '127.0.0.1',
        port: this.port,
        path: '/',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': postData.length
        }
    };
    log(this.id, 'posting ' + postData);

    // start a timeout that kills the job and process if we do not receive an answer from the worker in time
    that.waitingTimeout = setTimeout(function() {
        log(that.id, 'worker seems to be dead, we got no response for ' + JSON.stringify(data) + ' / ' + (new Date()).toString());
        jobCallback(new Error('Worker Timeout'));
        that.waitingTimeout = null;

        that.createProcess(); // this will kill the current running job and restart a new process
    }, WORKER_TIMEOUT);

    // the actual request
    var workerRequest = http.request(options, function(res) {
        var body = '';
        res.on('data', function (chunk) {
            body += chunk; // append chunks to get the whole body
        });

        // we got our response, let's check what's in the box
        res.on('end', function () {
            if (that.waitingTimeout) {
                clearTimeout(that.waitingTimeout); // clear the "worker did not answer" timeout
                try {
                    log(that.id, 'received result: ' + body);
                    // parse results and pass them to our callback
                    var result = JSON.parse(body);
                    jobCallback(null, result.data);
                    that.currentJob = null;
                    // TODO: if result is error use error callback

                    // check if phatomjs instance will close down
                    // if the worker signals he is closing, then we just wait for its closing
                    // otherwise we get a job for the worker
                    if (!result.closing) {
                        that.readyForWork();
                    }
                } catch (jsonParseError) {
                    // if that happens, we are in trouble
                    jobCallback(new Error('JSON.parse error (content: ' + body + ')'));
                    that.createProcess();
                }
            }
        });
    });

    workerRequest.on('error', function(e) {
        // let's hope this doesn't happen
        log(that.id, 'problem with request: ' + e.message);
    });

    // send request
    workerRequest.write(postData);
    workerRequest.end();
};


// factory for simplicity
Worker.create = function(id, callback) {
    return new Worker(id, callback);
};

module.exports = Worker;