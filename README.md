# Pokemon Go Notifier for Slack

## Purpose
To get notifications sent to Slack for Pokemon nearby a specified location. Works great for an office or school!

## Screenshot
![Pokemon Go Slack Notifier](http://i.imgur.com/aCx8hwK.png)

## Features
  * Nearby Pokemon notifications, including lured (Done)
  * Display location of the Pokemon on FastPokeMap / Google Maps (Done)
  * Display the Pokemon's expiration date (TODO)
  * Ignore list for unwanted Pokemon (Done, static config for now)
  * Specify a start and end time for receiving notifications (Done)
  * Command to add/remove Pokemon to the ignore list (TODO)
  * Command to change the location (TODO)

## Known Issues
  * May report Pokemon that are a little out of range
  * Will not work when run on hosting services like AWS since Niantic is blocking requests

## Requirements
  * Node.js
  * npm
  * git

## Installation and Setup
  * Install the above requirements
  * Get a copy of the repo
  * Install the npm dependencies
  * Set up an Incoming WebHook Integration for your Slack user or channel
  * Create a config.json based on a copy of a sample config
    * [config.sample1.json](./config.sample1.json) shows how to use a Google account and a GPS coordinate 
    * [config.sample2.json](./config.sample2.json) shows how to use a Pokemon Trainer Club account and a mailing address
  * (Optional) Create an ignore_list.js based on a copy of the [ignore_list.sample.js](./ignore_list.sample.js) if you want to ignore certain Pokemon
  * Run "node app.js" to start the notifier

## Recommendations
 * Use a dummy account for authenticating with Google or Pokemon Trainer Club

Thanks to Armax, the creator of [Pokemon-GO-node-api](https://github.com/Armax/Pokemon-GO-node-api) which this project uses for interfacing with the Pokemon Go API.
