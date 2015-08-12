
var Pool = require('../../lib/phantomjs-pool').Pool;

function jobCallback(job, worker, index) {
    job({
        index : index,
        moreData : "Hello World!"
    }, function(err, data) {
        if (err) {
            console.log('We got an error for worker #' + err.workerId + ': ' + err.message);
        } else {
            console.log('I got data back from worker #' + data.workerId + ': ' + data.indexBack + ' (more data: ' + data.foo + ').');
        }
    });
}


var pool = new Pool({
    size : 3,
    jobCallback : jobCallback,
    workerFile : __dirname + '/worker.js'
});
pool.start();