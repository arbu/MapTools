/**
 * Copyright 2013-2014 Moritz Hilscher
 * Copyright 2020 Aaron Bulmahn
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const INTERVAL = 5 * 1000;
const ANIMATED = true;
const JSON_PATH = "players.json";
const NETHER_PREFIX = "nether_";
const END_PREFIX = "end_";
const DEFAULT_SKIN = "http://assets.mojang.com/SkinTemplates/steve.png";

var PlayerMarker = L.Marker.extend({
    initialize: function(mapcrafterUi, username, options) {
        L.Util.setOptions(this, options);
        this.options.title= this.username;

        const skinClass = CSS.escape('skin-' + username +
            (Math.floor(Math.random() * 1000000)));

        this.options.icon = L.divIcon({
            iconSize: [16, 64],
            html:
                `<div class="skin ${skinClass}">` +
                '<span class="skin-air-head-l"></span>' +
                '<span class="skin-head skin-opaque"></span>' +
                '<span class="skin-air-head-r"></span>' +
                '<span class="skin-arm-l skin-opaque"></span>' +
                '<span class="skin-body skin-opaque"></span>' +
                '<span class="skin-arm-r skin-opaque"></span>' +
                '<span class="skin-air-legs-l"></span>' +
                '<span class="skin-leg-l skin-opaque"></span>' +
                '<span class="skin-leg-r skin-opaque"></span>' +
                '<span class="skin-air-legs-r"></span>' +
                '</div>',
        });

        this.mapcrafterUi = mapcrafterUi;
        this.username = username;

        if(!PlayerMarker.hasOwnProperty("_skinStyleSheet")) {
            PlayerMarker._skinStyleSheet = document.createElement('style');
            document.head.appendChild(PlayerMarker._skinStyleSheet);
        }

        const ruleIndex = PlayerMarker._skinStyleSheet.sheet.insertRule(
            `.${skinClass} span.skin-opaque {}`,
            PlayerMarker._skinStyleSheet.sheet.cssRules.length
        );

        this.cssRule = PlayerMarker._skinStyleSheet.sheet.cssRules[ruleIndex];

        const statusDiv = $('<div class="player-status"></div>');
        this.statusName = $('<span class="player-status-name"></span>').appendTo(statusDiv);
        this.statusLevel = $('<span class="player-status-level"></span>').appendTo(statusDiv);
        const healthBackground = $('<div class="player-status-health-background"></div>').appendTo(statusDiv);
        this.statusHealth = $('<div class="player-status-health"></div>').appendTo(healthBackground);

        this.popup = L.popup({offset: [0, -25]});
        this.popup.setContent(statusDiv[0]);
        this.bindPopup(this.popup);

        this.animation = null;
        this.layer = null;
        this.zooming = false
    },

    updatePlayer: function(layer, player) {
        this.cssRule.style.setProperty(
            "background-image",
            "url(" + (player.textures.SKIN || DEFAULT_SKIN) + ")",
            "important"
        );
        this.mcLocation = player.location;
        this.statusName.text(player.username);
        this.statusLevel.text(Math.floor(player.level));
        this.statusHealth.width(player.health * 9);

        const location = this.mapcrafterUi.mcToLatLng(
            this.mcLocation[0],
            this.mcLocation[2],
            this.mcLocation[1]
        );

        this._stopAnimateMove();
        if(this.layer != layer) {
            this.remove();
            this.setLatLng(location);
            this.layer = layer;
            this.addTo(this.layer);
        } else {
            if(ANIMATED) {
                this.animateFrom = this.getLatLng();
                this.animateTo = location;
                this.animateStart = performance.now();
                this._animateMove(performance.now());
            } else {
                this.setLatLng(location);
            }
        }
    },

    resetLocation: function() {
        const location = this.mapcrafterUi.mcToLatLng(
            this.mcLocation[0],
            this.mcLocation[2],
            this.mcLocation[1]
        );
        this._stopAnimateMove();
        this.setLatLng(location);
    },

    _animationFrame: function(timePassed) {
        return L.latLng(
            this.animateFrom.lat + ((this.animateTo.lat - this.animateFrom.lat) * timePassed / INTERVAL),
            this.animateFrom.lng + ((this.animateTo.lng - this.animateFrom.lng) * timePassed / INTERVAL)
        );
    },

    _animateMove: function(timestamp) {
        const timePassed = timestamp - this.animateStart;

        if(timePassed >= INTERVAL) {
            this.animation = null;
            this.setLatLng(this.animateTo);
            return;
        }

        this.setLatLng(this._animationFrame(timePassed));
        this.animation = L.Util.requestAnimFrame(this._animateMove.bind(this));
    },

    _stopAnimateMove: function() {
        if(this.animation) {
            L.Util.cancelAnimFrame(this.animation);
            this.animation = null;
        }
    },

    _animateZoom: function(opt) {
        let latLng = this.getLatLng();
        if(this.animation) {
            this._stopAnimateMove();
            const zoomEnd = performance.now() - this.animateStart + 250;
            if((INTERVAL - zoomEnd) > 250) {
                latLng = this._animationFrame(zoomEnd);
                this._map.on('zoomend', this._endZoom, this);
            } else {
                latLng = this.animateTo;
            }
        }

        this._setPos(
            this._map._latLngToNewLayerPoint(latLng, opt.zoom, opt.center).round()
        );
    },

    _endZoom: function(opt) {
        this._map.off('zoomend', this._endZoom, this);
        this._animateMove(performance.now());
    },

    destroy: function() {
        this._stopAnimateMove();
        this.remove();
    }
});

MapPlayerMarkerHandler.prototype = new BaseHandler();

function MapPlayerMarkerHandler() {
    this.players = new Map();

    this.documentTitle = document.title;

    this.visible = true;
    this.activeLayer = null;
}

MapPlayerMarkerHandler.prototype.create = function() {
    this.layerByWorld = new Map();
    this.layerByMap = new Map();
    this.ui.getMapConfigsOrder().forEach((mapName) => {
        const world = this.ui.getMapConfig(mapName).worldName;
        if(!this.layerByWorld.has(world)) {
            this.layerByWorld.set(world, new L.layerGroup());
            this.layerByWorld.set(world + "_nether", new L.layerGroup());
            this.layerByWorld.set(world + "_the_end", new L.layerGroup());
        }

        if(mapName.toLowerCase().startsWith(END_PREFIX)) {
            this.layerByMap.set(mapName, this.layerByWorld.get(world + "_the_end"));
        } else if(mapName.toLowerCase().startsWith(NETHER_PREFIX)) {
            this.layerByMap.set(mapName, this.layerByWorld.get(world + "_nether"));
        } else {
            this.layerByMap.set(mapName, this.layerByWorld.get(world));
        }
    });

    if($("#control-wrapper-marker").length > 0) {
        const button = $(
            '<button type="button" class="list-group-item list-group-item-info">' +
                '<span class="badge"></span>' +
                '<span class="right-padding">Players</span>' +
            '</button>'
        )
        .click(() => {
            button.toggleClass("list-group-item-info");
            this.visible = button.hasClass("list-group-item-info");
            if(this.visible) {
                this.activeLayer.addTo(this.ui.lmap);
            } else {
                this.activeLayer.remove();
            }
        });
        button.prependTo("#control-wrapper-marker .list-group");
        console.log(button);
        console.log($("#control-wrapper-marker .list-group"));
        this.controlBadge = button.find(".badge");
    } else {
        this.controlBadge = null;
    }

    window.setInterval(this.updatePlayers.bind(this), INTERVAL);
    this.updatePlayers();
};

MapPlayerMarkerHandler.prototype.onMapChange = function(mapName, rotation) {
    if(this.activeLayer != this.layerByMap.get(mapName)) {
        if(this.activeLayer) {
            this.activeLayer.remove();
        }
        this.activeLayer = this.layerByMap.get(mapName);
        if(this.visible) {
            this.activeLayer.addTo(this.ui.lmap);
        }
        this.updateCounter();
    }
    this.players.forEach((player) => player.resetLocation());
};

MapPlayerMarkerHandler.prototype.updateCounter = function() {
    let counter = 0;
    this.players.forEach((player) => {
        if(player.layer == this.activeLayer) {
            counter++;
        }
    });

    document.title = "(" + counter + "/" + this.players.size + ") " + this.documentTitle;
    if(this.controlBadge) {
        this.controlBadge.text(counter + "/" + this.players.size);
    }
};

MapPlayerMarkerHandler.prototype.updatePlayers = function(data) {
    $.getJSON(JSON_PATH, (data) => {
        if(!data)
            return;

        data.players.forEach((player) => {
            const username = player.username;
            if(!this.players.has(username)) {
                this.players.set(username, new PlayerMarker(this.ui, username));
            }
            this.players.get(username).updatePlayer(this.layerByWorld.get(player.world), player);
        });

        const onlinePlayers = data.players.map((player) => player.username);

        this.players.forEach((marker, username) => {
            if(onlinePlayers.indexOf(username) === -1) {
                marker.destroy();
                this.players.delete(username);
            }
        });

        this.updateCounter();
    });
};
