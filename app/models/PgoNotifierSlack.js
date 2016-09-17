
var PgoNotifierSlackAttachment = require('./PgoNotifierSlackAttachment.js');
var request = require('request');


/**
 * @param {string} slack_url - Slack Incoming Webhook url
 */
function PgoNotifierSlack(slack_url) {

  this.request_data = {
    username: "Pokemon Go",
    icon_url: "http://i.imgur.com/10m9yIQ.png",
    attachments: []
  };
  this.url = slack_url;


  /**
   * Adds a new entry to the list of Pokemon to notify users of
   *
   * @param {object} pokemon - Generic info about a Pokemon
   * @param {object} time_expires - Date when the Pokemon expires
   * @param {number} latitude - Latitude location of Pokemon in degrees
   * @param {number} longitude - Longitude location of Pokemon in degrees
   */
  this.addNearbyPokemon = function(pokemon, time_expires, latitude, longitude)
  {
    var new_attachment = new PgoNotifierSlackAttachment(pokemon, time_expires, latitude, longitude);
    this.request_data.attachments.push(new_attachment);
    console.log('[i] Added notification for ' + pokemon.name);
  }


  /**
   * Posts the found Pokemon to Slack
   *
   * @param {string} slack_url - Slack incoming webhook url
   * @param {object[]} nearby_pokemon_fields - Array of Slack attachment objects
   */
  this.postToSlack = function(slack_url)
  {
    if (this.request_data.attachments.length > 0)
    {
      request.post(
        {
          url: this.url,
          json: true,
          headers: {
            "content-type": "application/json",
          },
          body: this.request_data
        }, 
        function(error, response, body) {
          console.log(body);
        }
      );
    }
  }

}


module.exports = PgoNotifierSlack;
