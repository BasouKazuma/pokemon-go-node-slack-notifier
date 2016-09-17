
// This is 3 minutes but added some extra time to prevent duplicates for now.
const LURE_SPAWN_RATE = (3 * 60 * 1000) + (10 * 1000);

function PgoNotifierDiscoveredLuredPokemon(pokemon, fort)
{
  var current_time_object = new Date();
  var current_time = current_time_object.getTime();
  // var lure_time_remaining = fort.LureInfo.LureExpiresTimestampMs.toString() - current_time;
  // var time_remaining = lure_time_remaining % LURE_SPAWN_RATE;

  this.pokemon = pokemon;
  this.fort_id = fort.FortId;
  this.duration = LURE_SPAWN_RATE;
  this.time_added = current_time;
}

module.exports = PgoNotifierDiscoveredLuredPokemon;
