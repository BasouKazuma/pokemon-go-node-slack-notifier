var PokemonApi = require('pokemon-go-node-api');

// Required user generated config file
var config = require('./config.json');
var request = require('request');
var express = require("express");
var app = express();

const POKEVISION_URL = "https://pokevision.com/";
const FASTPOKEMAP_URL = "https://fastpokemap.se/";
const GOOGLE_MAPS_URL = "https://www.google.com/maps/place/";

const GOOGLE_PROVIDER = "google";
const POKEMON_TRAINER_CLUB_PROVIDER = "ptc";

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


/***** FUNCTIONS *****/


/**
 * @param {object} config - Data necessary to run the app
 * 
 * @returns {boolean} whether or not the given config is valid
 */
var isConfigValid = function(config)
{
    if (!config.username
        || !config.password
        || !isProviderValid(config.provider)
        || !config.slack_request_url
        || !config.port
        || !config.start_time
        || !config.end_time
        || !isLocationValid(config.location))
    {
        return false;
    }
    return true;
}


/**
 * @param {string} provider - The provider to log into
 * 
 * @returns {boolean} whether or not the given provider is valid
 */
var isProviderValid = function(provider)
{
    if (provider != POKEMON_TRAINER_CLUB_PROVIDER
        && provider != GOOGLE_PROVIDER)
    {
        return false;
    }
    return true;
}


/**
 * @param {object} location - Location data
 * 
 * @returns {boolean} whether or not the given location is valid
 */
var isLocationValid = function(location)
{
    switch(location.type)
    {
        case "coords":
            if (!location.coords.latitude
            || !location.coords.longitude
            || !location.coords.altitude)
            {
                return false;
            }
            break;
        case "name":
            if (!location.name)
            {
                return false;
            }
            break;
        default:
            return false;
    }
    return true;
}


/**
 * Takes a hh:mm timestamp and converts it to just minutes
 *
 * @param {string} time - A timestamp in the format hh:mm
 * 
 * @returns {number} of minutes
 */
var getHoursMinutesToMinutes = function(time)
{
    var time_array = time.split(":");
    return parseInt(time_array[0]) * 60 + parseInt(time_array[1]);
}


/**
 * @param {number} lat1 - First latitude in degrees
 * @param {number} long1 - First longitude in degrees
 * @param {number} lat2 - Second latitude in degrees
 * @param {number} long2 - Second longitude in degrees
 * 
 * @ returns {number} Distance between 2 GPS coordinates in meters
 */
var distanceBetweenCoordinates = function(lat1, long1, lat2, long2)
{
    var R = 6371e3; // metres
    var radians_lat1 = Math.PI * lat1/180;
    var radians_lat2 = Math.PI * lat2/180;
    var radians_long1 = Math.PI * long1/180;
    var radians_long2 = Math.PI * long2/180;
    var delta_lat = radians_lat2 - radians_lat1;
    var delta_long = radians_long2 - radians_long1;

    var a = Math.sin(delta_lat/2) * Math.sin(delta_lat/2) +
            Math.cos(radians_lat1) * Math.cos(radians_lat2) *
            Math.sin(delta_long/2) * Math.sin(delta_long/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    var d = R * c;
    return d;
}


/**
 * Posts the found Pokemon to Slack
 *
 * @param {string} slack_url - Slack incoming webhook url
 * @param {object[]} nearby_pokemon_fields - Array of Slack attachment objects
 */
var postToSlack = function(slack_url, nearby_pokemon_fields)
{
    var slack_data = {
        username: "Pokemon Go",
        icon_url: "http://i.imgur.com/10m9yIQ.png",
        attachments: nearby_pokemon_fields
    };
    request.post(
        {
            url: slack_url,
            json: true,
            headers: {
               "content-type": "application/json",
            },
            body: slack_data
        }, 
        function(error, response, body) {
            console.log(body);
        }
    );
}


/**
 * Adds a new entry to the list of Pokemon to notify users of in this iteration
 *
 * @param {object[]} nearby_pokemon_fields - Array of Slack attachment objects
 * @param {object} pokemon - Generic info about a Pokemon
 * @param {number} latitude - Latitude location of Pokemon in degrees
 * @param {number} longitude - Longitude location of Pokemon in degrees
 * 
 * @returns {object[]} of Slack attachment objects
 */
var addNearbyPokemon = function(nearby_pokemon_fields, pokemon, latitude, longitude)
{
    nearby_pokemon_fields.push(
        {
            fallback: pokemon.name + " is nearby!",
            title: pokemon.name,
            text:  pokemon.name + " is nearby. Go catch it already!\n " +
                //"<" + POKEVISION_URL + "#/@" + latitude +"," + longitude + "|Pokevision>" + 
                "<" + FASTPOKEMAP_URL + "#" + latitude +"," + longitude + "|FastPokeMap>" + 
                " | " +
                " <" + GOOGLE_MAPS_URL + latitude +"," + longitude +"|Google Maps>",
            // thumb_url: "https://ugc.pokevision.com/images/pokemon/" + pokemon.id + ".png",
            // thumb_url: "http://sprites.pokecheck.org/i/" + pokemon.num + ".gif",
            // thumb_url: "http://www.pkparaiso.com/imagenes/xy/sprites/pokemon/" + pokemon.num + ".png",
            thumb_url: "http://pokedream.com/pokedex/images/sugimori/" + pokemon.num + ".jpg",
            short: false
        }
    );
    console.log('[i] Added notification for ' + pokemon.name);
    return nearby_pokemon_fields;
}


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
    var nearby_pokemon_fields = [];

    for (var i = hb.cells.length - 1; i >= 0; i--)
    {

        for (var n = hb.cells[i].Fort.length - 1; n >= 0; n--)
        {
            var fort = hb.cells[i].Fort[n];
            var notify_pokemon = true;
            var distance_from_fort = distanceBetweenCoordinates(
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
                    nearby_pokemon_fields = addNearbyPokemon(nearby_pokemon_fields, pokemon, fort.Latitude, fort.Longitude);
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
                    nearby_pokemon_fields = addNearbyPokemon(nearby_pokemon_fields, pokemon, wildPokemon.Latitude, wildPokemon.Longitude);
                    discovered_pokemon = addDiscoveredPokemon(discovered_pokemon, pokemon, wildPokemon);
                }
            } 
        }
    }

    if (nearby_pokemon_fields.length > 0)
    {
        postToSlack(config.slack_request_url, nearby_pokemon_fields);
    }
    discovered_pokemon = removeExpiredPokemon(discovered_pokemon);
    discovered_lured_pokemon = removeExpiredLuredPokemon(discovered_lured_pokemon);

}


/***** APP LOGIC *****/

// Exit the app if the config is invalid
if (!isConfigValid(config))
{
    console.log("Invalid config.json file!");
    process.exit(1);
}

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
        var start_time_minutes = getHoursMinutesToMinutes(config.start_time);
        var end_time_minutes = getHoursMinutesToMinutes(config.end_time);
        var current_time_minutes = getHoursMinutesToMinutes(time);
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