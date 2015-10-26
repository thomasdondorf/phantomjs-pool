# PhantomJS Pool Library

Create a pool of PhantomJS workers.

## Install

`npm install phantomjs-pool`

Download or build the binary for PhantomJS and put the file into the `bin` directory.

## Usage

Check out the examples directory. Here is the minimal example, which saves screenshots of Google for numbers from 0 to 4.

#### master.js

    var Pool = require('phantomjs-pool').Pool;
    
    function jobCallback(job, worker, index) {
    
        if (index < 5) { // we just use the index as our data
            job(index, function(err) {
                console.log('DONE: ' + index);
            });
        } else { // no more jobs
            job(null);
        }
    }
    
    var pool = new Pool({
        numWorkers : 3,
        jobCallback : jobCallback,
        workerFile : __dirname + '/worker.js' // location of our worker file (as an absolute path)
    });
    pool.start();

#### worker.js

    var webpage = require('webpage');
    
    module.exports = function(data, done, worker) {
        var page = webpage.create();
    
        // search for the given data (which contains the index number) and save it as screenshot
        page.open('https://www.google.com/search?q=' + data, function() {
            page.render('google' + data + '.png');
            done(null);
        });
    
    };

## How does it work?

More information coming soon.

## License

MIT License.