(function(statsController) {
  statsController.init = function(app) {
    app.get('/api/:instanceId/stats/:name', require('./statsGet'));
  };
}(module.exports));