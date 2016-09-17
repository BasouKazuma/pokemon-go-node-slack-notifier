
var PgoNotifierHelper = require('./PgoNotifierHelper.js');
var pgo_notifier_helper = new PgoNotifierHelper();

const GOOGLE_PROVIDER = "google";
const POKEMON_TRAINER_CLUB_PROVIDER = "ptc";

function PgoNotifierConfigValidator(config)
{
    this.config = config;

    /**
     * 
     * @returns {boolean} whether or not the given config is valid
     */
    this.isConfigValid = function()
    {
        if (!this.config.username
            || !this.config.password
            || !this.isProviderValid(config.provider)
            || !this.config.slack_request_url
            // || !this.config.slack_token // optional
            // || !this.config.port // optional
            // || !this.config.start_time // optional
            // || !this.config.end_time // optional
            || !this.isLocationValid(config.location))
        {
            return false;
        }
        return true;
    }
    
    
    /**
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

    
    /**
     * 
     * @returns {boolean} whether or not a time window exists
     */
    this.hasTimeWindow = function()
    {
        if (!config.start_time || !config.end_time)
        {
            return false;
        }
        return true;
    }
    
    
    /**
     * 
     * @returns {boolean} whether or not the time window is valid
     */
    this.isTimeWindowValid = function()
    {
        if (!this.hasTimeWindow())
        {
            return false;
        }
        var start_time_minutes = pgo_notifier_helper.getHoursMinutesToMinutes(config.start_time);
        var end_time_minutes = pgo_notifier_helper.getHoursMinutesToMinutes(config.end_time);
        if (start_time_minutes > end_time_minutes)
        {
            return false;
        }
        return true;
    }
    
    
    /**
     * @param {string} time - The time to check against the time window
     * 
     * @returns {boolean} whether or not the given time is within the time window
     */
    this.withinTimeWindow = function(time)
    {
        if (!this.hasTimeWindow())
        {
            return true;
        }
        if (!this.isTimeWindowValid())
        {
            return false;
        }
        var start_time_minutes = pgo_notifier_helper.getHoursMinutesToMinutes(config.start_time);
        var end_time_minutes = pgo_notifier_helper.getHoursMinutesToMinutes(config.end_time);
        var current_time_minutes = pgo_notifier_helper.getHoursMinutesToMinutes(time);
        if (current_time_minutes < start_time_minutes
            || current_time_minutes > end_time_minutes)
        {
            return false;
        }
        return true;
    }

}

module.exports = PgoNotifierConfigValidator;
