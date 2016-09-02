var PokemonApi = require('pokemon-go-node-api');

// Required user generated config file
var config = require('./config.json');
var PgoNotifierConfigValidator = require('./PgoNotifierConfigValidator.js');
var PgoNotifierHelper = require('./PgoNotifierHelper.js');
var pgo_notifier_helper = new PgoNotifierHelper();
var PgoNotifierSlack = require('./PgoNotifierSlack.js');
var PgoNotifierDiscoveredPokemon = require('./PgoNotifierDiscoveredPokemon.js');
var PgoNotifierDiscoveredLuredPokemon = require('./PgoNotifierDiscoveredLuredPokemon.js');
var PgoNotifierLocation = require('./PgoNotifierLocation.js');
var PgoNotifierLocationList = require('./PgoNotifierLocationList.js');
var PgoNotifierIgnoreList = require('./PgoNotifierIgnoreList.js');

var request = require('request');
var express = require("express");
var app = express();
var fs = require('fs');
var https = require('https');
var bodyParser = require('body-parser');

// Setup the server if the port is specified
if (config.port)
{
    var server = https.createServer(
        {
            key: fs.readFileSync('./tls/key.pem'),
            cert: fs.readFileSync('./tls/cert.pem')
        },
        app
    );
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    server.listen(config.port);
}

const PGO_DISCOVERED_TYPE_WILD = 1;
const PGO_DISCOVERED_TYPE_LURE = 2;

const HEARTBEAT_TIME_INTERVAL = 10 * 1000;

// Store what was already discovered to prevent duplicate messages
var discovered_pokemon_list = [];
var discovered_lured_pokemon_list = [];

// Optional list of Pokemon to suppress notifications for
try {
    var ignore_list_data = require('./ignore_list.json');
} catch (ex) {
    var ignore_list_data = [];
}
var ignore_list = new PgoNotifierIgnoreList(ignore_list_data);

// Optional list of saved locations
try {
    var location_list_data = require(LOCATION_LIST_FILE);
} catch (ex) {
    var location_list_data = [];
}
var location_list = new PgoNotifierLocationList(location_list_data);



// Exit the app if the config is invalid
var config_validator = new PgoNotifierConfigValidator(config);
if (!config_validator.isConfigValid())
{
    console.log("Invalid config.json file! Consult the Readme.md.");
    process.exit(1);
}

/***** FUNCTIONS *****/


/**
 * Updates the config file to match the new config
 * 
 * @param {object} new_config - Contains the new config
 */
var updateConfigFile = function(new_config)
{
    config_data = JSON.stringify(new_config, null, 4);
    fs.writeFileSync('./config.json', config_data);
}


/**
 *
 *
 */
var sendSlackMessage = function(response_type, text, response_url)
{
    request.post(
        {
            url: response_url,
            json: true,
            headers: {
                "content-type": "application/json",
            },
            body: {
                response_type: response_type,
                text: text
            }
        }, 
        function(error, response, body) {
            console.log(body);
        }
    );
}


/**
 * Removed any expired entries from the discovered list
 *
 * @param {object[]} discovered_pokemon_list - List of recent Pokemon already encountered
 *
 * @returns {object[]} of recent Pokemon already encountered
 */
var removeExpiredPokemon = function(discovered_pokemon_list)
{
    var current_time_object = new Date();
    current_time = current_time_object.getTime();
    for (var m = discovered_pokemon_list.length - 1; m >= 0; m--)
    {
        var expiry_time = discovered_pokemon_list[m].time_added + discovered_pokemon_list[m].duration;
        if (expiry_time < current_time)
        {
            var pokemon = discovered_pokemon_list[m].pokemon;
            discovered_pokemon_list.splice(m, 1);
            console.log('[i] Removed stale discovery entry for ' + pokemon.name);
        }
    }
    return discovered_pokemon_list;
}


/**
 * Removes any expired entries from the discovered list for Lure Pokemon
 *
 * @param {object[]} discovered_lured_pokemon_list - List of recent Pokemon already encountered
 *
 * @returns {object[]} of recent Pokemon already encountered
 */
var removeExpiredLuredPokemon = function(discovered_lured_pokemon_list)
{
    var current_time_object = new Date();
    current_time = current_time_object.getTime();
    for (var m = discovered_lured_pokemon_list.length - 1; m >= 0; m--)
    {
        var expiry_time = discovered_lured_pokemon_list[m].time_added + discovered_lured_pokemon_list[m].duration;
        if (expiry_time < current_time)
        {
            var pokemon = discovered_lured_pokemon_list[m].pokemon;
            discovered_lured_pokemon_list.splice(m, 1);
            console.log('[i] LURED: Removed stale discovery entry for ' + pokemon.name);
        }
    }
    return discovered_lured_pokemon_list;
}


/**
 * Finds and sends notifications for nearby Pokemon
 *
 * @param {object[]} hb - Payload of data returned by the Pokemon Go API
 */
var findPokemon = function(hb) {
    // var fallback_text = "Nearby Pokemon: ";
    var pgo_notifier_slack = new PgoNotifierSlack(config.slack_request_url);

    if (typeof hb.cells === "undefined"
        || hb.cells == null
        || hb.cells.length <= 0)
    {
        console.log("[i] The API returned an empty array. Your account may have been banned.");
    }
    else
    {
        for (var i = hb.cells.length - 1; i >= 0; i--)
        {
    
            for (var n = hb.cells[i].Fort.length - 1; n >= 0; n--)
            {
                var fort = hb.cells[i].Fort[n];
                var notify_pokemon = true;
                var distance_from_fort = pgo_notifier_helper.distanceBetweenCoordinates(
                        fort.Latitude,
                        fort.Longitude,
                        config.location.coords.latitude,
                        config.location.coords.longitude
                    );
                if (fort.LureInfo
                    && distance_from_fort < 50.0)
                {
                    var pokemon = pokeio_instance.pokemonlist[parseInt(fort.LureInfo.ActivePokemonId)-1];
                    console.log('[i] LURED: There is a ' + pokemon.name + ' nearby');
                    if (ignore_list.isPokemonIgnored(pokemon.id))
                    {
                        notify_pokemon = false;
                    }
    
                    for (var m = discovered_lured_pokemon_list.length - 1; m >= 0; m--)
                    {
                        if (discovered_lured_pokemon_list[m].fort_id == fort.FortId
                            && discovered_lured_pokemon_list[m].pokemon.id == pokemon.id)
                        {
                            notify_pokemon = false;
                        }
                    }
    
                    if (notify_pokemon == true)
                    {
                        // console.log("Fort is " + distance_from_fort + " meters away");
                        var discovered_lured_pokemon = new PgoNotifierDiscoveredLuredPokemon(pokemon, fort);
                        var lured_time_expires = discovered_lured_pokemon.time_added + discovered_lured_pokemon.duration;
                        var lured_time_expires_object = new Date(lured_time_expires);
                        pgo_notifier_slack.addNearbyPokemon(pokemon, lured_time_expires_object, fort.Latitude, fort.Longitude);
                        discovered_lured_pokemon_list.push(discovered_lured_pokemon);
                        console.log('[i] LURED: Added discovery entry for ' + pokemon.name);
                    }
                }
            }
    
            if (hb.cells[i].WildPokemon[0])
            // if (hb.cells[i].MapPokemon[0])
            {
                for (var j = hb.cells[i].WildPokemon.length - 1; j >= 0; j--)
                // for (var j = hb.cells[i].MapPokemon.length - 1; j >= 0; j--)
                {
                    var wildPokemon = hb.cells[i].WildPokemon[j];
                    // var wildPokemon = hb.cells[i].MapPokemon[j];
                    var pokemon = pokeio_instance.pokemonlist[parseInt(wildPokemon.pokemon.PokemonId)-1];
                    // var pokemon = pokeio_instance.pokemonlist[parseInt(wildPokemon.PokedexTypeId)-1];
                    console.log('[i] There is a ' + pokemon.name + ' nearby');
                    
                    var notify_pokemon = true;
                    
                    if (ignore_list.isPokemonIgnored(pokemon.id))
                    {
                        notify_pokemon = false;
                    }
                    
                    for (var m = discovered_pokemon_list.length - 1; m >= 0; m--)
                    {
                        if (discovered_pokemon_list[m].encounter_id.low == wildPokemon.EncounterId.low &&
                            discovered_pokemon_list[m].encounter_id.high == wildPokemon.EncounterId.high &&
                            discovered_pokemon_list[m].encounter_id.unsigned == wildPokemon.EncounterId.unsigned)
                        {
                            notify_pokemon = false;
                        }
                    }
                    
                    if (notify_pokemon == true)
                    {
                        // fallback_text += pokemon.name + ' |';
                        var discovered_pokemon = new PgoNotifierDiscoveredPokemon(pokemon, wildPokemon);
                        var time_expires = discovered_pokemon.time_added + discovered_pokemon.duration;
                        var time_expires_object = new Date(time_expires);
                        pgo_notifier_slack.addNearbyPokemon(pokemon, time_expires_object, wildPokemon.Latitude, wildPokemon.Longitude);
                        discovered_pokemon_list.push(discovered_pokemon);
                        console.log('[i] Added discovery entry for ' + pokemon.name);
                    }
                }
            }
        }
    }

    pgo_notifier_slack.postToSlack(config.slack_request_url);
    discovered_pokemon_list = removeExpiredPokemon(discovered_pokemon_list);
    discovered_lured_pokemon_list = removeExpiredLuredPokemon(discovered_lured_pokemon_list);

}


/***** APP LOGIC *****/


var current_location = {
    type: "coords",
    coords: {
        latitude: config.location.coords.latitude,
        longitude: config.location.coords.longitude,
        altitude: config.location.coords.altitude
    }
};

var pokeio_instance = new PokemonApi.Pokeio();
pokeio_instance.init(config.username, config.password, config.location, config.provider, function(err) {
    if (err)
    {
        console.log(err);
    }
});

setInterval(function() {
    pokeio_instance.Heartbeat(function(err,hb) {
        var current_time_object = new Date();
        var time = current_time_object.getHours() + ":" + ("0" + current_time_object.getMinutes()).slice(-2);
        console.log("*** NEW RUN @ " + time + ":" + ("0" + current_time_object.getSeconds()).slice(-2) + " ***");
        if (current_location.coords.latitude != config.location.coords.latitude
            || current_location.coords.longitude != config.location.coords.longitude
            || current_location.coords.altitude != config.location.coords.altitude)
        {
            err = "Location changed!";
            current_location = {
                type: "coords",
                coords: {
                    latitude: config.location.coords.latitude,
                    longitude: config.location.coords.longitude,
                    altitude: config.location.coords.altitude
                }
            };
        }
        if (!config_validator.withinTimeWindow(time))
        {
            console.log("[i] Current Time is " + time + ". Reporting will be online between " + config.start_time + " and " + config.end_time);
        }
        else if (err)
        {
            console.log(err);
            // Try to log back in
            pokeio_instance = new PokemonApi.Pokeio();
            pokeio_instance.init(config.username, config.password, config.location, config.provider, function(err) {
                if (err)
                {
                    console.log(err);
                }
            });
        }
        else
        {
            findPokemon(hb);
        }
    });
}, HEARTBEAT_TIME_INTERVAL);


/***** WEB ROUTING *****/


app.get("/", function(req, res) {
    res.send("<h1>Soylent Candy is made out of Pokemon!</h1>");
});


app.post("/slack", function(req, res) {
    var token = req.body.token;
    var team_id = req.body.team_id;
    var team_domain = req.body.team_domain;
    var channel_id = req.body.channel_id;
    var channel_name = req.body.channel_name;
    var user_id = req.body.user_id;
    var user_name = req.body.user_name;
    var command = req.body.command;
    var text = req.body.text;
    var response_url = req.body.response_url;

    if (config.slack_token == token)
    {
        var text_array = text.split(" ");
        switch(text_array[0])
        {
            case "help":
                var response_type = "ephemeral";
                var body_text = "*Available Commands*\n";
                body_text +=  " - ignore [pokemon number] (Add a Pokemon to the ignore list)\n";
                body_text +=  " - unignore [pokemon number] (Remove a Pokemon to the ignore list)\n";
                body_text +=  " - ignorelist (List the Pokemon currently being ignored)\n";
                body_text +=  " - location [optional_name] [latitude] [longitude] (Changes the location to scan in decimal degrees)\n";
                body_text +=  " - locationlist (Lists the saved locations)\n";
                sendSlackMessage(response_type, body_text, response_url);
                break;
            case "ignore":
                var response_type = "in_channel";
                var pokemon_id = text_array[1];
                var pokemon = pokeio_instance.pokemonlist[parseInt(pokemon_id)-1];
                if (pokemon && !ignore_list.isPokemonIgnored(pokemon.id))
                {
                    ignore_list.add(pokemon.id);
                    var body_text = pokemon.name + " was added to the ignore list.";
                }
                else
                {
                    var body_text = pokemon.name + " is already being ignored.";
                }
                sendSlackMessage(response_type, body_text, response_url);
                break;
            case "unignore":
                var response_type = "in_channel";
                var pokemon_id = text_array[1];
                var pokemon = pokeio_instance.pokemonlist[parseInt(pokemon_id)-1];
                if (pokemon && ignore_list.isPokemonIgnored(pokemon.id))
                {
                    ignore_list.remove(pokemon.id);
                    var body_text = pokemon.name + " was removed from the ignore list.";
                }
                else
                {
                    var body_text = pokemon.name + " wasn't in the ignore list.";
                }
                sendSlackMessage(response_type, body_text, response_url);
                break;
            case "ignorelist":
                var response_type = "in_channel";
                var body_text = "*Ignored Pokemon*\n";
                if (ignore_list.data.length > 0)
                {
                    for (var i = 0; i <= ignore_list.data.length - 1; i ++)
                    {
                        var pokemon = pokeio_instance.pokemonlist[parseInt(ignore_list.data[i])-1];
                        body_text += " - " + pokemon.name + "\n";
                    }
                }
                else
                {
                    body_text += "No Pokemon are currently being ignored.";
                }
                sendSlackMessage(response_type, body_text, response_url);
                break;
            case "location":
                var response_type = "in_channel";
                var check_param1 = parseFloat(text_array[1]);
                if (isNaN(check_param1))
                {
                    var location_label = text_array[1];
                    var latitude = parseFloat(text_array[2]);
                    var longitude = parseFloat(text_array[3]);
                }
                else
                {
                    var latitude = parseFloat(text_array[1]);
                    var longitude = parseFloat(text_array[2]);
                }
                if (!isNaN(latitude)
                    && !isNaN(longitude))
                {
                    config.location.coords.latitude = latitude;
                    config.location.coords.longitude = longitude;
                    updateConfigFile(config);
                    if (location_label)
                    {
                        location_list.add(location_label, latitude, longitude);
                        var body_text = "The location was updated to latitude:" + latitude + ", longitude:" + longitude + " and saved as *" + location_label + "*.";
                    }
                    else
                    {
                        var body_text = "The location was updated to latitude:" + latitude + ", longitude:" + longitude;
                    }
                }
                else if (location_label)
                {
                    var location = location_list.getLocation(location_label);
                    if (location)
                    {
                        var latitude = location.coords.latitude;
                        var longitude = location.coords.longitude;
                        config.location.coords.latitude = latitude;
                        config.location.coords.longitude = longitude;
                        var body_text = "The location was updated to latitude:" + latitude + ", longitude:" + longitude;
                    }
                    else
                    {
                        var body_text = "No location found for that label.";
                    }
                }
                else
                {
                    var body_text = "Unable to update the location.";
                }
                sendSlackMessage(response_type, body_text, response_url);
                break;
            case "removelocation":
                var response_type = "in_channel";
                if (location_list.labelInUse(location_label))
                {
                    location_list.remove(location_label);
                    var body_text = "Location label *" + location_label + "* was removed.";
                }
                else
                {
                    var body_text = "Location label *" + location_label + "* was not found.";
                }
                break;
            case "locationlist":
                var response_type = "in_channel";
                var body_text = "*Location List*\n";
                for (var i = 0; i <= location_list.data.length - 1; i++)
                {
                    var location_label = location_list.data[i].label;
                    var latitude = location_list.data[i].location.coords.latitude;
                    var longitude = location_list.data[i].location.coords.longitude;
                    var altitude = location_list.data[i].location.coords.altitude;
                    body_text += " - Label: " + location_label + " Latitude: " + latitude + " Longitude: " + longitude + " Altitude: " + altitude +"\n";
                }
                sendSlackMessage(response_type, body_text, response_url);
                break;
            default:
                break;
        }
    }
    else
    {
        console.log("Invalid slack token.");
    }
    res.send(null);
});
