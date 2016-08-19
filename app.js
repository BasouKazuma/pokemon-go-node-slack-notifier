var PokemonApi = require('pokemon-go-node-api');

// Required user generated config file
var config = require('./config.json');
var PgoNotifierConfigValidator = require('./PgoNotifierConfigValidator.js');
var PgoNotifierHelper = require('./PgoNotifierHelper.js');
var pgo_notifier_helper = new PgoNotifierHelper();
var PgoNotifierSlack = require('./PgoNotifierSlack.js');

var request = require('request');
var express = require("express");
var app = express();

const PGO_DISCOVERED_TYPE_WILD = 1;
const PGO_DISCOVERED_TYPE_LURE = 2;

// This is 3 minutes but added some extra time to prevent duplicates for now.
const LURE_SPAWN_RATE = (3 * 60 * 1000) + (10 * 1000);
const HEARTBEAT_TIME_INTERVAL = 10 * 1000;

// Store what was already discovered to prevent duplicate messages
var discovered_pokemon = [];
var discovered_lured_pokemon = [];

// Optional list of Pokemon to suppress notifications for
try {
    var pokemon_ignore_list = require('./ignore_list.js');
} catch (ex) {
    var pokemon_ignore_list = [];
}

// Set default start and end time values if they don't exist
if (!config.start_time)
{
    config.start_time = "00:00";
}
if (!config.end_time)
{
    config.end_time = "24:00";
}

// Exit the app if the config is invalid
var config_validator = new PgoNotifierConfigValidator(config);
if (!config_validator.isConfigValid())
{
    console.log("Invalid config.json file!");
    process.exit(1);
}

/***** FUNCTIONS *****/


/**
 * Adds to a list of Pokemon that were already discovered
 *
 * @param {object[]} discovered_pokemon - List of recent Pokemon already encountered
 * @param {object} pokemon - Generic info about a Pokemon
 * @param {object} wildPokemon - Instance specific info about the encountered Pokemon
 *
 * @returns {object[]} of recent Pokemon already encountered
 */
var addDiscoveredPokemon = function(discovered_pokemon, pokemon, wildPokemon)
{
    var current_time_object = new Date();
    current_time = current_time_object.getTime();
    discovered_pokemon.push(
        {
            type: PGO_DISCOVERED_TYPE_WILD,
            pokemon: pokemon,
            encounter_id: wildPokemon.EncounterId,
            time_remaining: wildPokemon.TimeTillHiddenMs,
            // time_remaining: wildPokemon.ExpirationTimeMs.toString() - current_time,
            // time_expires: wildPokemon.TimeTillHiddenMs + current_time,
            // time_expires: wildPokemon.ExpirationTimeMs.toString(),
            time_added: current_time
        }
    );
    console.log('[i] Added discovery entry for ' + pokemon.name);
    return discovered_pokemon;
}


/**
 * Adds to a list of Lured Pokemon that were already discovered
 *
 * @param {object[]} discovered_lured_pokemon - List of recent Pokemon already encountered
 * @param {object} pokemon - Generic info about a Pokemon
 * @param {object} fort - Instance specific info about the nearby Fort/PokeStop
 *
 * @returns {object[]} of recent Pokemon already encountered
 */
var addDiscoveredLuredPokemon = function(discovered_lured_pokemon, pokemon, fort)
{
    var current_time_object = new Date();
    current_time = current_time_object.getTime();
    // var lure_time_remaining = fort.LureInfo.LureExpiresTimestampMs.toString() - current_time;
    // var time_remaining = lure_time_remaining % LURE_SPAWN_RATE;
    discovered_lured_pokemon.push(
        {
            pokemon: pokemon,
            fort_id: fort.FortId,
            time_remaining: LURE_SPAWN_RATE,
            time_added: current_time
        }
    );
    console.log('[i] LURED: Added discovery entry for ' + pokemon.name);
    return discovered_lured_pokemon;
}


/**
 * Removed any expired entries from the discovered list
 *
 * @param {object[]} discovered_pokemon - List of recent Pokemon already encountered
 *
 * @returns {object[]} of recent Pokemon already encountered
 */
var removeExpiredPokemon = function(discovered_pokemon)
{
    var current_time_object = new Date();
    current_time = current_time_object.getTime();
    for (var m = discovered_pokemon.length - 1; m >= 0; m--)
    {
        var expiry_time = discovered_pokemon[m].time_added + discovered_pokemon[m].time_remaining;
        if (expiry_time < current_time)
        {
            var pokemon = discovered_pokemon[m].pokemon;
            discovered_pokemon.splice(m, 1);
            console.log('[i] Removed stale discovery entry for ' + pokemon.name);
        }
    }
    return discovered_pokemon;
}


/**
 * Removes any expired entries from the discovered list for Lure Pokemon
 *
 * @param {object[]} discovered_lured_pokemon - List of recent Pokemon already encountered
 *
 * @returns {object[]} of recent Pokemon already encountered
 */
var removeExpiredLuredPokemon = function(discovered_lured_pokemon)
{
    var current_time_object = new Date();
    current_time = current_time_object.getTime();
    for (var m = discovered_lured_pokemon.length - 1; m >= 0; m--)
    {
        var expiry_time = discovered_lured_pokemon[m].time_added + discovered_lured_pokemon[m].time_remaining;
        if (expiry_time < current_time)
        {
            var pokemon = discovered_lured_pokemon[m].pokemon;
            discovered_lured_pokemon.splice(m, 1);
            console.log('[i] LURED: Removed stale discovery entry for ' + pokemon.name);
        }
    }
    return discovered_lured_pokemon;
}


/**
 * Finds and sends notifications for nearby Pokemon
 *
 * @param {object[]} hb - Payload of data returned by the Pokemon Go API
 */
var findPokemon = function(hb) {
    // var fallback_text = "Nearby Pokemon: ";
    var pgo_notifier_slack = new PgoNotifierSlack(config.slack_request_url);

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

                for (var m = discovered_lured_pokemon.length - 1; m >= 0; m--)
                {
                    if (discovered_lured_pokemon[m].fort_id == fort.FortId
                        && discovered_lured_pokemon[m].pokemon.id == pokemon.id)
                    {
                        notify_pokemon = false;
                    }
                }

                if (notify_pokemon == true)
                {
                    console.log("Fort is " + distance_from_fort + " meters away");
                    pgo_notifier_slack.addNearbyPokemon(pokemon, fort.Latitude, fort.Longitude);
                    discovered_lured_pokemon = addDiscoveredLuredPokemon(discovered_lured_pokemon, pokemon, fort);
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
                
                for (var m = discovered_pokemon.length - 1; m >= 0; m--)
                {
                    if (discovered_pokemon[m].encounter_id.low == wildPokemon.EncounterId.low &&
                        discovered_pokemon[m].encounter_id.high == wildPokemon.EncounterId.high &&
                        discovered_pokemon[m].encounter_id.unsigned == wildPokemon.EncounterId.unsigned)
                    {
                        notify_pokemon = false;
                    }
                }
                
                if (notify_pokemon == true)
                {
                    // fallback_text += pokemon.name + ' |';
                    pgo_notifier_slack.addNearbyPokemon(pokemon, wildPokemon.Latitude, wildPokemon.Longitude);
                    discovered_pokemon = addDiscoveredPokemon(discovered_pokemon, pokemon, wildPokemon);
                }
            } 
        }
    }

    pgo_notifier_slack.postToSlack(config.slack_request_url);
    discovered_pokemon = removeExpiredPokemon(discovered_pokemon);
    discovered_lured_pokemon = removeExpiredLuredPokemon(discovered_lured_pokemon);

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
        var time = current_time_object.getHours() + ":" + ("0" + current_time_object.getMinutes()).slice(-2);;
        console.log("*** NEW RUN @" + time + ":" + ("0" + current_time_object.getSeconds()).slice(-2) + " ***");
        var start_time_minutes = pgo_notifier_helper.getHoursMinutesToMinutes(config.start_time);
        var end_time_minutes = pgo_notifier_helper.getHoursMinutesToMinutes(config.end_time);
        var current_time_minutes = pgo_notifier_helper.getHoursMinutesToMinutes(time);
        if (current_time_minutes < start_time_minutes
            || current_time_minutes > end_time_minutes)
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

app.listen(config.port);