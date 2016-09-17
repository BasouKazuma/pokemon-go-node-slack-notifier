
const LOCATION_TYPE_COORDINATES = 'coords';
const LOCATION_TYPE_ADDRESS = 'name';


function PgoNotifierLocation(type, data)
{
    switch(type)
    {
        case LOCATION_TYPE_COORDINATES:
            this.type = type;
            this.coords = data;
            break;
        case LOCATION_TYPE_ADDRESS:
            this.type = type;
            this.name = data;
            break;
        default:
            this.type = null;
            break;
    }


    this.isValid = function()
    {
        if (this.isValidType()
          && this.isValidData())
        {
            return true;
        }
        return false;
    }


    this.isValidType = function()
    {
        if (this.type != LOCATION_TYPE_COORDINATES
          && this.type != LOCATION_TYPE_ADDRESS)
        {
            return false;
        }
    }


    this.isValidData = function()
    {
        switch(this.type)
        {
            case LOCATION_TYPE_COORDINATES:
                if (!isNaN(parseFloat(this.coords.latitude))
                  && !isNaN(parseFloat(this.coords.longitude))
                  && !isNaN(parseFloat(this.coords.altitude)))
                {
                    return true
                }
                break;
            case LOCATION_TYPE_ADDRESS:
                if (typeof(this.name === 'string'))
                {
                    return true;
                }
                break;
            default:
                break;
        }
        return false;
    }

}
module.exports = PgoNotifierLocation;
