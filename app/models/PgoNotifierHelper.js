

function PgoNotifierHelper()
{

  /**
   * Takes a hh:mm timestamp and converts it to just minutes
   *
   * @param {string} time - A timestamp in the format hh:mm
   * 
   * @returns {number} of minutes
   */
  this.getHoursMinutesToMinutes = function(time)
  {
      var time_array = time.split(":");
      return parseInt(time_array[0]) * 60 + parseInt(time_array[1]);
  }
  
  
  /**
   * @param {number} lat1 - First latitude in degrees
   * @param {number} long1 - First longitude in degrees
   * @param {number} lat2 - Second latitude in degrees
   * @param {number} long2 - Second longitude in degrees
   * 
   * @returns {number} Distance between 2 GPS coordinates in meters
   */
  this.distanceBetweenCoordinates = function(lat1, long1, lat2, long2)
  {
      var R = 6371e3; // metres
      var radians_lat1 = Math.PI * lat1/180;
      var radians_lat2 = Math.PI * lat2/180;
      var radians_long1 = Math.PI * long1/180;
      var radians_long2 = Math.PI * long2/180;
      var delta_lat = radians_lat2 - radians_lat1;
      var delta_long = radians_long2 - radians_long1;
  
      var a = Math.sin(delta_lat/2) * Math.sin(delta_lat/2) +
              Math.cos(radians_lat1) * Math.cos(radians_lat2) *
              Math.sin(delta_long/2) * Math.sin(delta_long/2);
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
      var d = R * c;
      return d;
  }

}

module.exports = PgoNotifierHelper;
