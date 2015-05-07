var Stats = function(instance) {
    var stat = function(name, partition, apiKey) {
        return $.ajax({
            url: "/api/"+instance+"/stats/"+name,
            type: "GET",
            data: {
                partition: partition,
                apiKey:apiKey
            }
        });
    }
    return {
      statsPerDigest: function(partition, apiKey){
        return stat("digestCommitsStats", partition, apiKey);
      }
    }
}
var Render = function() {
    var renderTile = function(container, name, value) {
        var name = name || "";
        var value = value || "";
        var description = name || "";
        var mainElement = $(document.createElement("div")).addClass("item").addClass("summary-value").attr("id", name).attr("style","border:1px solid black");

        container.append(mainElement);
        var effectLayerDiv = $(document.createElement("div")).addClass("effect-layer");
        var valueLabelDiv = $(document.createElement("div")).addClass("value-label-pair");
        mainElement.append(effectLayerDiv, valueLabelDiv);

        var valueDiv = $(document.createElement("div")).addClass("value").html(value);
        var labelDiv = $(document.createElement("div")).addClass("label").html(description);

        valueLabelDiv.append(valueDiv, labelDiv);
    };
    var renderTitle = function(container, name, value) {
        container.append("<div id='" + name + "' class='item'><h2>" + value + "</h2></div>");
    }

    return {
        tiles: function(container, responseJson) {
            for (var prop in responseJson) {
                renderTile(container, prop, responseJson[prop]);
            }
        },
        usersActivity: function(main, responseJson) {
            var containers = [];
            for (var prop in responseJson) {
                containers.push(prop);
                var container = $(document.createElement("div")).attr("id",prop);
                main.append(container);
                renderTitle(container, prop, prop);
                for(var user in responseJson[prop]){
                  renderTile(container,user,responseJson[prop][user]);
                }
            }
            return containers;
        }
    }
}