
module.exports = function(data, done, worker) {

    console.log('Logging works too! Yay!');

    if (worker.id === 1) {
        // let's create an error case everytime worker 1 does something
        setTimeout(function() {
            done(new Error('Error, I dont work for this worker!'));
        }, 2000);
    } else {
        var data = {
            workerId : worker.id,
            indexBack : data.index, // this does not make any sense, but let's just send the index back
            foo : 'Greetings, Friend!'
        };

        // I let it look like we did some work...
        setTimeout(function() {
            done(null, data);
        }, 5000 + Math.random());

    }
};