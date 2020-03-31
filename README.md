# MapTools #

MapTools is a small Bukkit plugin to provide additional informations from a
Minecraft Server to a map rendered with tools such as
[mapcrafter](http://github.com/m0r13/mapcrafter). The plugin writes every few
seconds a JSON-File with informations about the players (for example their position) 
to the filesystem.

MapTools is free software and available under the GPL license.

## Build ##

To build this, you need the craftbukkit-JAR. Running
[BuildTools](https://www.spigotmc.org/wiki/buildtools/) with your desired version
(e.g. `java -jar BuildTools.jar --rev 1.15.2 --compile craftbukkit`) will
install it to your local maven repository. After that you can run `mvn package`
in the root of this repo to build the plugin.

## Configuration ##

You can specify a few options in the configuration file (`config.yml`):

`markerFile`

This is the output filename of the JSON-File (relative to the server
directory). It defaults to `markers.json`.

`interval`

This is the interval to write the file (in seconds). It defaults to 5 seconds.

`offlineResolveTextures`

When in offline-mode the server won't fetch the players profiles and therefore does
not have the skin information. If this is true, it will try to load the profile
directly from the mojang servers.

## mapcrafter ##

In order to display players on a [mapcrafter](https://github.com/mapcrafter/mapcrafter)
map, copy the `static/` directory to your mapcrafter template directory (usually at
`/usr/share/mapcrafter/template` on Linux) and modify the template `index.html` to
contain the following lines:

  * Add `<link rel="stylesheet" type="text/css" href="static/css/style.css" />`
    below the other stylesheet tags.

  * Add `<script type="text/javascript" src="static/js/playermarkers.js"></script>`
    below the other script tags.

  * Add `Mapcrafter.addHandler(new MapPlayerMarkerHandler());` to the end of the 
    init function.
