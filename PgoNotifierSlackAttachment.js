
const POKEVISION_URL = "https://pokevision.com/";
const FASTPOKEMAP_URL = "https://fastpokemap.se/";
const GOOGLE_MAPS_URL = "https://www.google.com/maps/place/";

function PgoNotifierSlackAttachment(pokemon, latitude, longitude)
{
  this.fallback = pokemon.name + " is nearby!";
  this.title = pokemon.name;
  this.text = pokemon.name + " is nearby. Go catch it already!\n " +
                //"<" + POKEVISION_URL + "#/@" + latitude +"," + longitude + "|Pokevision>" + 
                "<" + FASTPOKEMAP_URL + "#" + latitude +"," + longitude + "|FastPokeMap>" + 
                " | " +
                " <" + GOOGLE_MAPS_URL + latitude +"," + longitude +"|Google Maps>";
                // thumb_url: "https://ugc.pokevision.com/images/pokemon/" + pokemon.id + ".png";
  // this.thumb_url = "http://sprites.pokecheck.org/i/" + pokemon.num + ".gif";
  // this.thumb_url = "http://www.pkparaiso.com/imagenes/xy/sprites/pokemon/" + pokemon.num + ".png";
  this.thumb_url = "http://pokedream.com/pokedex/images/sugimori/" + pokemon.num + ".jpg";
  short = false;

}

module.exports = PgoNotifierSlackAttachment;
