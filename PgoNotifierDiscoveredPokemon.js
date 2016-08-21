

function PgoNotifierDiscoveredPokemon(pokemon, wildPokemon)
{
  var current_time_object = new Date();
  var current_time = current_time_object.getTime();

  this.pokemon = pokemon;
  this.encounter_id = wildPokemon.EncounterId;
  this.duration = wildPokemon.TimeTillHiddenMs;
  // this.duration = wildPokemon.ExpirationTimeMs.toString() - current_time;
  // this.time_expires = wildPokemon.TimeTillHiddenMs + current_time;
  // this.time_expires: wildPokemon.ExpirationTimeMs.toString();
  this.time_added = current_time;
}

module.exports = PgoNotifierDiscoveredPokemon;
