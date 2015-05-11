(function() {
    var eventStore = require('../helpers/eventStoreClient');

    module.exports = function(req, res, next) {
        if (req.query.partition) {
            eventStore.queryStatePartitionById({
                name: req.params.name,
                partition: req.query.partition
            }).then(function(state) {
                res.send(state);
            });
        } else {
            eventStore.queryStateById({
                name: req.params.name
            }).then(function(state) {
                res.send(state);
            });
        }
    };
}());