var Pokeio = require('pokemon-go-node-api');

// Required user generated config file
var config = require('./config.json');
var request = require('request');
var express = require("express");
var app = express();

var pokevision_url = "https://pokevision.com/";
var google_maps_url = "https://www.google.com/maps/place/";

// Store what was already discovered to prevent duplicate messages
var discovered_pokemon = [];

// Optional list of Pokemon to suppress notifications for
try {
    var pokemon_ignore_list = require('./ignore_list.js');
} catch (ex) {
    var pokemon_ignore_list = [];
}

var heartbeatTimeInterval = 10 * 1000;

var post_to_slack = function(url, data)
{
    request.post(
        {
            url: url,
            json: true,
            headers: {
               "content-type": "application/json",
            },
            body: data
        }, 
        function(error, response, body) {
            console.log(body);
        }
    );
}

var add_discovered_pokemon = function(discovered_pokemon, pokemon, wildPokemon)
{
    var current_time_object = new Date();
    current_time = current_time_object.getTime();
    discovered_pokemon.push(
        {
            pokemon: pokemon,
            encounter_id: wildPokemon.EncounterId,
            time_remaining: wildPokemon.TimeTillHiddenMs,
            time_added: current_time
        }
    );
    console.log('[i] Added discovery entry for ' + pokemon.name);
    return discovered_pokemon;
}

var remove_expired_pokemon = function(discovered_pokemon)
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

var findPokemon = function(pokeio_instance, config) {
    pokeio_instance.Heartbeat(function(err,hb) {
        var current_time_object = new Date();
        current_time = current_time_object.getTime();
        console.log("*** NEW RUN @" + current_time + " ***");
        if (err)
        {
            console.log(err);
            if (err == 'No result')
            {
                // Try to log back in
                pokeio_instance.init(config.username, config.password, config.location, config.provider, function(err) {
                    if (err)
                    {
                        console.log(err);
                    }
                });
            }
        }
        else
        {
            var fallback_text = "Nearby Pokemon: ";
            var nearby_pokemon_fields = [];

            for (var i = hb.cells.length - 1; i >= 0; i--)
            {
                if (hb.cells[i].WildPokemon[0])
                {
                    for (var j = hb.cells[i].WildPokemon.length - 1; j >= 0; j--)
                    {
                        var wildPokemon = hb.cells[i].WildPokemon[j];
                        var pokemon = pokeio_instance.pokemonlist[parseInt(wildPokemon.pokemon.PokemonId)-1];
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
                            fallback_text += pokemon.name + ' |';
                            nearby_pokemon_fields.push(
                                {
                                    fallback: pokemon.name + " is nearby!",
                                    title: pokemon.name,
                                    text:  pokemon.name + " is nearby. Go catch it already!\n " +
                                        "<" + pokevision_url + "#/@" + wildPokemon.Latitude +"," + wildPokemon.Longitude + "|Pokevision>" + 
                                        " | " +
                                        " <" + google_maps_url + wildPokemon.Latitude +"," + wildPokemon.Longitude +"|Google Maps>",
                                    // thumb_url: "https://ugc.pokevision.com/images/pokemon/" + pokemon.id + ".png",
                                    // thumb_url: "http://sprites.pokecheck.org/i/" + pokemon.num + ".gif",
                                    // thumb_url: "http://www.pkparaiso.com/imagenes/xy/sprites/pokemon/" + pokemon.num + ".png",
                                    thumb_url: "http://pokedream.com/pokedex/images/sugimori/" + pokemon.num + ".jpg",
                                    short: false
                                }
                            );
                            console.log('[i] Added notification for ' + pokemon.name);
                            
                            discovered_pokemon = add_discovered_pokemon(discovered_pokemon, pokemon, wildPokemon);

                        }
                    } 
                }
            }

            var slackData = {
              attachments: nearby_pokemon_fields
            };
            
            post_to_slack(config.slack_request_url, slackData);

            discovered_pokemon = remove_expired_pokemon(discovered_pokemon);

        }

    });
};

var pokeio_instance = Pokeio;
pokeio_instance.init(config.username, config.password, config.location, config.provider, function(err) {
    if (err)
    {
        console.log(err);
    }
});

setInterval(function() {
    findPokemon(pokeio_instance, config);
}, heartbeatTimeInterval);


app.get("/",function(req,res) {
        res.send("<h1>Soylent Candy is made out of Pokemon!</h1>");
});

app.listen(config.port);
