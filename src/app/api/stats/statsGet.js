(function() {
  var eventStore = require('../helpers/eventStoreClient');

  module.exports = function(req, res, next) {
    eventStore.queryStatePartitionById({
      name: req.params.name,
      partition: req.query.partition
    }).then(function(state) {
      res.send(state);
    });
  };
}());