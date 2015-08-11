
var webpage = require('webpage');

module.exports = function(data, done, worker) {
    var page = webpage.create();

    // search for the given data (which contains the index number) and save it as screenshot
    page.open('https://www.google.com/search?q=' + data, function() {
        page.render('google' + data + '.png');
        done(null);
    });

};