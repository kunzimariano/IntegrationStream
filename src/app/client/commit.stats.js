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
      },
      mergeConflictAlerts: function(partition, apiKey){
        return stat("todayMergeAlert", partition, apiKey);
      }
    }
}
var Translate = function() {
    var simpleTranslator = function(name, value, description) {
        return {
            "id": "id-" + name.toLowerCase().replace(/ /g, ''),
            "name": name,
            "value": value,
            "description": description
        }
    }
    var digestCommitsTranslator = function(rawDigestCommitsStats) {
        var ret = [];
        var singleStatTranslator = function(rawStats, statKey, details) {
            var sum = 0;
            for (var detail in rawStats[statKey]) {
                details.push(simpleTranslator(detail, rawStats[statKey][detail], detail));
                sum += rawStats[statKey][detail];
            }
            return sum;
        }
        for (var key in rawDigestCommitsStats) {
            var summary;
            var details = [];
            if (key == "authorCount") {
                summary = simpleTranslator("Author Count", 0, "Author Count Description");
            } else if (key == "committerCount") {
                summary = simpleTranslator("Committer Count", 0, "Committer Count Description");
            } else if (key == "fileCount") {
                summary = simpleTranslator("File Count", 0, "File Count Description");
            }
            summary.value = singleStatTranslator(rawDigestCommitsStats, key, details);
            ret.push({
                "summary": summary,
                "details": details
            });
        }
        return ret;
    }
    var mergeConflictAlertsTranslator = function(rawMergeConflictAlets) {
        var ret = [];
        var singleMergeTranslator = function(rawStats, statKey, details) {}
        for (var key in rawMergeConflictAlets) {
            var summary;
            var details = [];
            summary = simpleTranslator("Merge Alerts", rawMergeConflictAlets[key].length, "Merge Alerts Description");
            for (var i=0; i < rawMergeConflictAlets[key].length; i++) {
                var filePathArr = rawMergeConflictAlets[key][i].file.split('/');
                var branches ="";
                for (var branch in rawMergeConflictAlets[key][i].branches){
                  branches += branch + "<br>";
                }
                details.push(simpleTranslator(rawMergeConflictAlets[key][i].file, filePathArr[filePathArr.length-1], branches));
            }
            ret.push({
                "summary": summary,
                "details": details
            });
        }
        return ret;
    }
    return {
        digestCommitsStats: function(rawDigestCommitsStats) {
            return digestCommitsTranslator(rawDigestCommitsStats);
        },
        mergeConflictAlerts: function(rawMergeConflictAlets) {
            return mergeConflictAlertsTranslator(rawMergeConflictAlets);
        }
    }
}
var Render = function() {
    var renderTile = function(container, simpleElement) {
        var id = simpleElement.id || "";
        var name = simpleElement.name || "";
        var value = simpleElement.value || "";
        var description = simpleElement.description || "";
        var mainElement = $(document.createElement("div")).addClass("item").addClass("summary-value").attr("id", id).attr("style", "border:1px solid black");

        container.append(mainElement);
        var effectLayerDiv = $(document.createElement("div")).addClass("effect-layer");
        var valueLabelDiv = $(document.createElement("div")).addClass("value-label-pair");
        mainElement.append(effectLayerDiv, valueLabelDiv);

        var valueDiv = $(document.createElement("div")).addClass("value").html(value);
        var labelDiv = $(document.createElement("div")).addClass("label").html(description);

        valueLabelDiv.append(valueDiv, labelDiv);
    };
    var renderStat = function(rawStats, transaleFn, summary, details) {
        var stats = transaleFn(rawStats);
        var createdElems = {};

        for (var i = 0; i < stats.length; i++) {
            renderTile(summary, stats[i].summary);
            var id = stats[i].summary.id;
            createdElems[id] = id + "-details";
            var detailsElems = $(document.createElement("div")).attr("id", id + "-details");
            for (var j = 0; j < stats[i].details.length; j++) {
                renderTile(detailsElems, stats[i].details[j]);
            };
            details.append(detailsElems);
        };
        return createdElems;
    };
    var translate = Translate();
    return {
        mergeConflictAlerts: function(rawStats, summary, details) {
            return renderStat(rawStats, translate.mergeConflictAlerts, summary, details);
        },
        digestCommitsStats: function(rawStats, summary, details) {
            return renderStat(rawStats, translate.digestCommitsStats, summary, details);
        }
    }
}