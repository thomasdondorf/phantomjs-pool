
var Pool = require('../../lib/phantomjs-pool').Pool;

var pages = [
    'http://www.google.com/',
    'http://www.example.com/',
    'http://www.stackoverflow.com/',
    'http://phantomjs.org/',
    'http://www.nodejs.org/',
    'http://www.reddit.com/',
    'http://www.youtube.com/',
    'http://www.amazon.com/'
];

// Called when a worker is ready for a new job
// job is the function that needs to be called to execute the job
// index contains a number (starting at 0) that is increased with each jobCallback call
function jobCallback(job, index) {

    // as long as we have urls that we want to crawl we execute the job
    var url = pages[index];
    if (index < pages.length) {

        // the first argument contains the data which is passed to the worker
        // the second argument is a callback which is called when the job is executed
        job({
            url : url,
            id : index
        }, function(err) {
            // Lets log if it worked
            if (err) {
                console.log('There were some problems for url ' + url + ': ' + err.message);
            } else {
                console.log('DONE: ' + url + '(' + index + ')');
            }
        });
    } else {
        // if we have no more jobs, we call the function job with null
        job(null);
    }
}

var pool = new Pool({
    size : 3,
    jobCallback : jobCallback,
    workerFile : __dirname + '/worker.js' // location of our worker file (as an absolute path)
});