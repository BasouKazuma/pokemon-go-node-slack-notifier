var Pokeio = require('pokemon-go-node-api');

// Required user generated config file
var config = require('./config.json');
var request = require('request');
var express = require("express");
var app = express();

var timeInterval = 10 * 1000;

var pokevision_url = "https://pokevision.com/";
var google_maps_url = "https://www.google.com/maps/place/";

// Store what was already discovered to prevent duplicate messages
var discovered_pokemon = [];

// Hardcoded for now
var pokemon_ignore_list = [
    84, // Doduo
    16, // Pidgey
    19, // Rattata
    41, // Zubat
    10, // Caterpie
    13, // Weedle
    21, // Spearow
    0 // Placeholder
];

Pokeio.init(config.username, config.password, config.location, config.provider, function(err) {
    setInterval(function(){
        Pokeio.Heartbeat(function(err,hb) {
            var current_time_object = new Date();
            current_time = current_time_object.getTime();
            console.log("*** NEW RUN @" + current_time +" ***");
            if (err)
            {
                console.log(err);
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
                            var pokemon = Pokeio.pokemonlist[parseInt(wildPokemon.pokemon.PokemonId)-1];
                            console.log('[i] There is a ' + pokemon.name + ' nearby');
                            
                            var notify_pokemon = true;
                            
                            for (k = 0; k < pokemon_ignore_list.length; k++)
                            {
                              if (pokemon_ignore_list[k] == pokemon.id)
                              {
                                notify_pokemon = false;
                              }
                            }
                            
                            for (var k = discovered_pokemon.length - 1; k >= 0; k--)
                            {
                                if (discovered_pokemon[k].encounter_id.low == wildPokemon.EncounterId.low &&
                                    discovered_pokemon[k].encounter_id.high == wildPokemon.EncounterId.high &&
                                    discovered_pokemon[k].encounter_id.unsigned == wildPokemon.EncounterId.unsigned)
                                {
                                    notify_pokemon = false;
                                }
                            }
                            
                            if (notify_pokemon == true)
                            {
                                fallback_text += pokemon.name + ' |';
                                nearby_pokemon_fields.push({
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
                                });
                                console.log('[i] Added notification for ' + pokemon.name);
                              }
                            
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
                            console.log('[i] Added discovered entry for ' + pokemon.name);
                        } 
                    }
                }

                var slackData = {
                  attachments: nearby_pokemon_fields
                };
                
                request.post(
                    {
                        url: config.slack_request_url,
                        json: true,
                        headers: {
                           "content-type": "application/json",
                        },
                        body: slackData
                    }, 
                    function(error, response, body) {
                        console.log(body);
                    }
                );

                // Remove any expired entries
                var current_time_object = new Date();
                current_time = current_time_object.getTime();
                for (m = discovered_pokemon.length - 1; m >= 0; m--)
                {
                    var expiry_time = discovered_pokemon[m].time_added + discovered_pokemon[m].time_remaining;
                    if (expiry_time < current_time)
                    {
                        discovered_pokemon.splice(m, 1);
                        console.log('[i] Removed stale discovered entry for  ' + pokemon.name);
                    }
                }

            }

        });
    }, timeInterval);
});


app.get("/",function(req,res) {
        res.send("<h1>Soylent Candy is made out of Pokemon!</h1>");
});

app.listen(80);
