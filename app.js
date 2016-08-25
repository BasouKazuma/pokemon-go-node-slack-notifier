var PokemonApi = require('pokemon-go-node-api');

// Required user generated config file
var config = require('./config.json');
var PgoNotifierConfigValidator = require('./PgoNotifierConfigValidator.js');
var PgoNotifierHelper = require('./PgoNotifierHelper.js');
var pgo_notifier_helper = new PgoNotifierHelper();
var PgoNotifierSlack = require('./PgoNotifierSlack.js');
var PgoNotifierDiscoveredPokemon = require('./PgoNotifierDiscoveredPokemon.js');
var PgoNotifierDiscoveredLuredPokemon = require('./PgoNotifierDiscoveredLuredPokemon.js');

var request = require('request');
var express = require("express");
var app = express();

const PGO_DISCOVERED_TYPE_WILD = 1;
const PGO_DISCOVERED_TYPE_LURE = 2;

const HEARTBEAT_TIME_INTERVAL = 10 * 1000;

// Store what was already discovered to prevent duplicate messages
var discovered_pokemon_list = [];
var discovered_lured_pokemon_list = [];

// Optional list of Pokemon to suppress notifications for
try {
    var pokemon_ignore_list = require('./ignore_list.js');
} catch (ex) {
    var pokemon_ignore_list = [];
}

// Exit the app if the config is invalid
var config_validator = new PgoNotifierConfigValidator(config);
if (!config_validator.isConfigValid())
{
    console.log("Invalid config.json file! Consult the Readme.md.");
    process.exit(1);
}

/***** FUNCTIONS *****/


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
                    for (var k = 0; k < pokemon_ignore_list.length; k++)
                    {
                        if (pokemon_ignore_list[k] == pokemon.id)
                        {
                          notify_pokemon = false;
                        }
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
                    
                    for (var k = 0; k < pokemon_ignore_list.length; k++)
                    {
                        if (pokemon_ignore_list[k] == pokemon.id)
                        {
                          notify_pokemon = false;
                        }
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


app.get("/",function(req,res) {
        res.send("<h1>Soylent Candy is made out of Pokemon!</h1>");
});

if (config.port)
{
    app.listen(config.port);
}
