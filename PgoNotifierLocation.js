
const LOCATION_TYPE_COORDINATES = 'coords';
const LOCATION_TYPE_ADDRESS = 'name';


function PgoNotifierLocation(type, data)
{
    switch(type)
    {
        case LOCATION_TYPE_COORDINATES:
        case LOCATION_TYPE_ADDRESS:
            this.type = type;
            this.{type} = data;
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
                if (!isNaN(parseFloat(this.{LOCATION_TYPE_COORDINATES}.latitude))
                  && !isNaN(parseFloat(this.{LOCATION_TYPE_COORDINATES}.longitude))
                  && !isNaN(parseFloat(this.{LOCATION_TYPE_COORDINATES}.altitude)))
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
