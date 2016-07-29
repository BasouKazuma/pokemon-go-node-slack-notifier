# Pokemon Go Notifier for Slack

## Purpose
To get notifications sent to Slack for Pokemon nearby a specified location. Works great for an office or school!

## Requirments
  * Node.js
  * npm
  * git

## Installation
  * Install the above requirements
  * Clone the repo
  * Install the npm dependencies
  * Set up a Slack Webhook Integration for your Slack user or channel
  * Create a config.json based on a copy of a sample config
    * config.sample1.json shows how to use a Google account and a GPS coordinate 
    * config.sample2.json shows how to use a Pokemon Trainer Club account and a mailing address

## Recommendations
 * Use a dummy account for authenticating with Google or Pokemon Trainer Club.

Thanks to Armax, the creator of [Pokemon-GO-node-api](https://github.com/Armax/Pokemon-GO-node-api) which this project uses for interfacing with the Pokemon Go API.
