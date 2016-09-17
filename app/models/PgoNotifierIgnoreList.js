
var fs = require('fs');

function PgoNotifierIgnoreList(ignore_list_data)
{
    this.data = ignore_list_data;


    /**
     *
     * @param {number} pokemon_id - Pokemon id number to be checked
     * @returns {boolean} whether or not the Pokemon is being ignored
     */
    this.isPokemonIgnored = function(pokemon_id)
    {
        for (var i = 0; i <= this.data.length - 1; i++)
        {
            if (this.data[i] == pokemon_id)
            {
              return true;
            }
        }
        return false;
    }


    /**
     * Adds a Pokemon to the ignore list
     *
     * @param {number} pokemon_id - Pokemon id number to be added
     */
    this.add = function(pokemon_id)
    {
        this.data.push(pokemon_id);
        this.updateFile();
    }

    /**
     * Removes a Pokemon from the ignore list
     *
     * @param {number} pokemon_id - Pokemon id number to be removed
     */
    this.remove = function(pokemon_id)
    {
        for (var i = this.data.length - 1; i >= 0; i--)
        {
            if (this.data[i] == pokemon_id)
            {
                this.data.splice(i, 1);
                this.updateFile();
            }
        }
    }


    /**
     * Updates the ignore list file to match the changes to the list
     */
    this.updateFile = function()
    {
        ignore_list_data = JSON.stringify(this.data, null, 4);
        fs.writeFileSync('./ignore_list.json', ignore_list_data);
    }

}

module.exports = PgoNotifierIgnoreList;
