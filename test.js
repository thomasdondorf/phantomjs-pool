
var page = require('webpage').create();

page.onResourceRequested = function (req) {
    console.log('Before error.');
    console.log(notExistingVariable);
    console.log('After error.');
};

page.open('http://www.google.com/', function(status) {
    console.log('status: ' + status);
});