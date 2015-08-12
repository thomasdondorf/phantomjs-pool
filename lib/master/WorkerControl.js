
var cp = require('child_process');
var http = require('http');
var querystring = require('querystring');

var phantomjsBinPath = 'bin/phantomjs';

var VERBOSE = false;

function log(workerId, msg) {
    if (VERBOSE) {
        console.log('    #' + workerId + ' ' + msg);
    }
}

function createError(workerId, msg) {
    var err = new Error(msg);
    err.workerId = workerId;
    return err;
}

// Number of current workers, to give new workers an id
var workerId = 0;

function Worker(pool) {
    this.id = workerId;
    workerId++;
    this.workerData = {
        id : this.id
    };
    this.pool = pool;
    this.createProcess();
    this.waitingTimeout = null;
    if (this.pool.verbose) {
        VERBOSE = true;
    }

    this.alive = true;
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
    if (this.pool.phantomjsOptions) {
        clArgs.unshift.apply(clArgs, this.pool.phantomjsOptions);
    }

     // TODO: check if phantomjs binary exists

    // Spawn process
    this.proc = cp.spawn(phantomjsBinPath, clArgs, { cwd : process.cwd() });
    this.proc.stdout.on('data', function (rawData) {
        var data = rawData.toString();

        // parse first data from the worker and interpret it as port number or output it
        if (that.port === undefined && data.indexOf('#|#port#|#') !== -1) {
            var splitted = data.split('#|#port#|#');
            that.port = parseInt(splitted[1]);
            log(that.id, ' starting on port: ' + that.port);

            // we are now ready setup and can start working
            that.readyForWork();
        } else {
            // output logging calls of the custom worker of the user
            data.split('\n').forEach(function(line) {
                if (line.trim().length !== 0) {
                    console.log('  #' + that.id + ' >> ' + line);
                }
            });
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

        // only do all that, if we did not close the process on our own
        if (signal !== 'SIGTERM') {
            // if we close the process on our own, we have already opened the next proc, so lets not set it to null
            that.proc = null; // there is no process anymore attached to this worker

            // code == 0 -> means worker closed as expected after he crawled several websites
            // (planned closing because of memory leak problems)
            if (code !== 0) { // sigterm means we killed the worker on our own
                log(that.id, 'closed with error code ' + code + ', signal: ' + signal);
                // use callback to signal error
                if (that.currentJob.callback) {
                    that.currentJob.callback(createError(that.id, 'PhantomJS error, closing signal: ' + signal));
                }
            }

            // if worker is still needed, restart process
            if (that.alive) {
                log(that.id, 'recreating phantomjs instance');
                that.createProcess();
            }
        }

    });

};


// called when the worker has no job and is ready to receive work
Worker.prototype.readyForWork = function() {
    if (this.currentJob) {
        log(this.id, 'ignoring the last job: ' + JSON.stringify(this.currentJob.data));
    }

    var that = this;
    this.pool.getJob(function (data, doneCallback) {
        if (data === null) { // no more data, we can close this worker
            if (that.proc) {
                log(that.id, 'closing worker');
                that.proc.kill();
            }
            that.alive = false;
        } else if (!that.alive) {
            throw createError(that.id, 'Worker was already closed. You cannot reuse a closed worker!');
        } else {
            that.work(data, doneCallback);
        }
    }, this.workerData);
};

// called by master -> contains a new job and a callback that should be called when the job is done or erroneous
Worker.prototype.work = function(data, givenJobCallback) {
    var that = this;
    that.currentJob = {
        data : data,
        callback : givenJobCallback
    };
    log(this.id, 'new job ' + JSON.stringify(data));

    function jobCallback(err, data) {
        if (givenJobCallback) {
            givenJobCallback(err, data);
        }
    }

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

    // start a timeout that kills the job and process if we do not receive an answer from the worker in time
    that.waitingTimeout = setTimeout(function() {
        log(that.id, 'worker seems to be dead, we got no response for ' + JSON.stringify(data) + ' / ' + (new Date()).toString());
        jobCallback(createError(that.id, 'Worker Timeout'));
        that.waitingTimeout = null;
        workerRequest.abort();

        that.createProcess(); // this will kill the current running job and restart a new process
    }, that.pool.workerTimeout);

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
                    if (result.status === 'success') {
                        jobCallback(null, result.data);
                    } else if (result.status === 'fail') {
                        jobCallback(createError(that.id, result.errMessage), result.data);
                    } else {
                        jobCallback(createError(that.id, 'Communication error between Master and Worker'));
                        result.closing = true;
                        that.createProcess();
                    }
                    that.currentJob = null;

                    // check if phatomjs instance will close down
                    // if the worker signals he is closing, then we just wait for its closing
                    // otherwise we get a job for the worker
                    if (!result.closing) {
                        that.readyForWork();
                    }
                } catch (jsonParseError) {
                    // if that happens, we are in trouble
                    jobCallback(createError(that.id, 'JSON.parse error (content: ' + body + ')'));
                    that.createProcess();
                }
            }
        });
    });

    workerRequest.on('error', function(e) {
        // should only happen if the worker somehow does not answer and we kill the process
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