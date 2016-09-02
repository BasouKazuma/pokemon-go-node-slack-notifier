const LOCATION_LIST_FILE = './location_list.json';


function PgoNotifierLocationList(location_list_data)
{

    this.data = location_list_data;


    /**
     *
     * @param {} location_label - The label for the location to return
     * @returns {object|null} The location that matches the label
     */
    this.getLocation = function(location_label)
    {
        for (var i = 0; i <= this.data.length - 1; i++)
        {
            if (this.data[i].label == location_label)
            {
                return this.data[i].location;
            }
        }
        return null;
    }


    /**
     *
     * @param {array} location_label - 
     */
    this.labelInUse = function(location_label)
    {
        for (var i = 0; i <= this.data.length - 1; i++)
        {
            if (this.data[i].label == location_label)
            {
                return true;
            }
        }
        return false;
    }


    /**
     *
     * @param {array} location_label - 
     * @param {number} latitude - 
     * @param {number} longitude - 
     */
    this.add = function(location_label, latitude, longitude)
    {
        if (this.labelInUse(location_label))
        {
            for (var i = 0; i <= this.data.length - 1; i++)
            {
                if (this.data[i].label == location_label)
                {
                    this.data[i].location.coords.latitude = latitude;
                    this.data[i].location.coords.longitude = longitude;
                }
            }
        }
        else
        {
            var type = PgoNotifierLocation.LOCATION_TYPE_COORDINATES;
            var coordinates = {
                latitude: latitude,
                longitude: longitude,
                altitude: 9.8
            };
            var new_location = new PgoNotifierLocation(type, coordinates);
            this.data.push({
                label: location_label,
                location: new_location
            });
        }
        this.updateFile();
    }


    /**
     *
     * @param {array} location_label - 
     */
    this.remove = function(location_label)
    {
        for (var i = this.data.length - 1; i >= 0; i--)
        {
            if (this.data[i].label == location_label)
            {
                this.data.splice(i, 1);
            }
        }
        this.updateFile();
    }


    this.updateFile = function()
    {
        fs.writeFileSync(
            LOCATION_LIST_FILE,
            JSON.stringify(this.data, null, 4)
        );
    }

}

module.exports = PgoNotifierLocationList;
