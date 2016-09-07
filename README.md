# Pokemon Go Notifier for Slack

## Purpose
To get notifications sent to Slack for Pokemon nearby a specified location. Works great for an office or school!

## Screenshot
![Pokemon Go Slack Notifier](http://i.imgur.com/aCx8hwK.png)

## Features
- [x] Nearby Pokemon notifications, including lured
- [x] Display location of the Pokemon on FastPokeMap / Google Maps
- [x] Ignore list for unwanted Pokemon (optional, static config for now)
- [x] Specify a start and end time for receiving notifications
- [x] Display the Pokemon's expiration date
- [x] Commands to add/remove Pokemon to the ignore list and display the currently ignored Pokemon
- [x] Command to change the location
- [ ] Command to start and stop reporting

## Known Issues
  * May report Pokemon that are a little out of range
  * Will not work when run on hosting services like AWS since Niantic is blocking requests

## Requirements
  * Node.js
  * npm
  * git

## Recommendations
 * Use a dummy account for authenticating with Google or Pokemon Trainer Club

## Installation and Setup
  * Install the above requirements
  * Get a copy of the repo
  * Install the npm dependencies
  * Set up an Incoming WebHook Integration for your Slack user or channel
  * Create a config.json based on a copy of a sample config
    * [config.sample1.json](./config.sample1.json) shows how to use a Google account and a GPS coordinate
    * [config.sample2.json](./config.sample2.json) shows how to use a Pokemon Trainer Club account, a mailing address, and time windowing
  * (Optional) Create an ignore_list.json containing an array of pokemon to ignore by number, based on a copy of the [ignore_list.sample.json](./ignore_list.sample.json) if you want to ignore certain Pokemon
  * (Optional) Set up the HTTPS webserver endpoint to process the Slack Commands
    * Copy the TLS keys for your domain to the `tls` folder named as `key.pem` and `cert.pem` respectively.
    * Set up a new custom Slack Command for your Slack team and set the URL to "[your_hostname]/slack"
    * Copy the Slack Command's token and add it to the `config.json`
  * Run "node app.js" to start the notifier

## Slash Commands
  * `help` - Lists the available slash commands
  * `ignore [pokemon number]` - Add a Pokemon to the ignore list
  * `unignore [pokemon number]` - Remove a Pokemon to the ignore list
  * `ignorelist [optional_label] [latitude] [longitude]` - List the Pokemon currently being ignored
  * `location [label]` - Changes the location to scan in decimal degrees
  * `removelocation` - Removes the specified location by label
  * `locationlist` - Lists the saved locations

## Config Parameters (nested)
### Authentication
  * `username` - Username for the selected account provider
  * `password` - Password for the selected account provider
  * `provider` - Either `google` or `ptc` (Pokemon Trainer Club)

### Slack Webhook
  * `slack_request_url` - Slack Incoming Webhook url from your slack integration

### Webserver (optional)
  * `slack_token` - Token to authenticate the Slack Slash Command
  * `port` - An open port the app can listen on for incoming Slack commands

### Time Windowing (optional)
  * `start_time` - The time in which to start scanning each day in h:mm format
  * `end_time` - The time in which to stop scanning each day in h:mm format

### Location (choose one type)
#### Coordinates
  * `location` - An object containing the location data
    * `type` - `coords`
    * `coords` - And object containing the GPS coordinates of the location you wish to scan from
      * `latitude` - The latitude in decimal degrees
      * `longitude` - The longitude in decimal degrees
      * `altitude` - The altitude in decimal degrees

#### Address
  * `location` - An object containing the location data
    * `type` - `name`
    * `name` - The address or name of the location you wish to scan from

Thanks to Armax, the creator of [Pokemon-GO-node-api](https://github.com/Armax/Pokemon-GO-node-api) which this project uses for interfacing with the Pokemon Go API.
