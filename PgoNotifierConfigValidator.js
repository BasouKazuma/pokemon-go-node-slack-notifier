
const GOOGLE_PROVIDER = "google";
const POKEMON_TRAINER_CLUB_PROVIDER = "ptc";

function PgoNotifierConfigValidator(config)
{
  this.config = config;

  /**
   * @param {object} config - Data necessary to run the app
   * 
   * @returns {boolean} whether or not the given config is valid
   */
  this.isConfigValid = function()
  {
      if (!this.config.username
          || !this.config.password
          || !this.isProviderValid(config.provider)
          || !this.config.slack_request_url
          // || !this.config.port // optional
          || !this.config.start_time
          || !this.config.end_time
          || !this.isLocationValid(config.location))
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
  this.isProviderValid = function()
  {
      if (this.config.provider != POKEMON_TRAINER_CLUB_PROVIDER
          && this.config.provider != GOOGLE_PROVIDER)
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
  this.isLocationValid = function()
  {
      switch(this.config.location.type)
      {
          case "coords":
              if (!this.config.location.coords.latitude
              || !this.config.location.coords.longitude
              || !this.config.location.coords.altitude)
              {
                  return false;
              }
              break;
          case "name":
              if (!this.config.location.name)
              {
                  return false;
              }
              break;
          default:
              return false;
      }
      return true;
  }

}

module.exports = PgoNotifierConfigValidator;
