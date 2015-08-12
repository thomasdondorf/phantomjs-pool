var webserver = require('webserver');
var system = require('system');

// our workerId as assigned by the master
var workerId = parseInt(system.args[system.args.length-2]);
var workerData = {
    id : workerId
};

// location of the users worker file
var workerFile = system.args[system.args.length-1];

var customWorker;
(function() {
    // setup some helper variables the script can use
    var lastSlash = Math.max(workerFile.lastIndexOf('/'), workerFile.lastIndexOf('\\'));
    __workerDirname = workerFile.substr(0, lastSlash);
    __workerFilename = workerFile;
    customWorker = require(workerFile);
}());


// how many jobs to work before we restart // TODO this should be configurable
var REQUESTS_BEFORE_WORKER_RESTART = 30;

// count requests to close if the max number (above) is reached
var totalRequests = 0;

function workerRequest(req, res) {
    totalRequests++;

    // job was executed, lets inform the master
    function jobDone(err, data) {
        // check if we close the connection after this (to prevent memory leaks)
        var closing = totalRequests > REQUESTS_BEFORE_WORKER_RESTART ? true : false;

        var msg = {};

        if (err) {
            msg.errMessage = err.message;
            msg.status = 'fail';
            closing = true; // always close the worker if any error happens
        } else {
            msg.status = 'success';
        }
        msg.data = data;
        msg.closing = closing;

        // send our data back to the master
        res.statusCode = 200;
        res.write(JSON.stringify(msg));
        res.close();

        // close this worker if necessary
        if (closing) {
            phantom.exit();
        }
    }

    // contains our job data
    var data = req.post.data;
    var parsedData = JSON.parse(data);
    // we pass this to our customWorker
    if (data) {
        try {
            customWorker(parsedData, jobDone, workerData);
        } catch (e) {
            res.statusCode = 200;
            res.write(JSON.stringify({
                errMessage : e.message,
                status : 'fail',
                closing : true
            }));
            res.close();
            phantom.exit();
        }
    } else {
        // sometimes the server seems to have problems receiving any data
        res.statusCode = 200;
        res.write(JSON.stringify({
            status : 'fail',
            data : 'No data for worker received ' + JSON.stringify(req.post)
        }));
        res.close();
    }
}

// we create a simple HTTP web server
var server = webserver.create();

// we want to find a port to open a REST server
// select port randomly until we find one
var portUsable = false;
var port;
while (!portUsable) {
    port = 1024 + parseInt(Math.random() * 40000);
    // port = 35556;
    portUsable = server.listen('127.0.0.1:' + port, workerRequest);
}

// output the port on the console, this will tell the master on which port he can speak to us
console.log('#|#port#|#' + port + '#|#port#|#');