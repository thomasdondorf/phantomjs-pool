
var webpage = require('webpage');

// worker needs to export one function which is called with the job
module.exports = function(data, done, worker) {

    // data contains the data we passed to the job function in the master file
    // done is a function which needs to be called to signal that the job is executed
    // worker contains some meta data about this worker (like the id)

    // we just fetch the page and save it as an image normally
    var page = webpage.create();
    page.open(data.url, function() {
        page.render(data.id + '.png');

        // then we call the done function with null to signal we sucessfully executed the job
        done(null);
    });

};