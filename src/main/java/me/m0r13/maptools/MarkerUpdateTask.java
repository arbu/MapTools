/*
 * Copyright 2013 Moritz Hilscher
 *
 * This file is part of MapTools.
 *
 * MapTools is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * MapTools is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with MapTools.  If not, see <http://www.gnu.org/licenses/>.
 */

package me.m0r13.maptools;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.TimeUnit;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.mojang.authlib.Agent;
import com.mojang.authlib.GameProfile;
import com.mojang.authlib.GameProfileRepository;
import com.mojang.authlib.ProfileLookupCallback;
import com.mojang.authlib.minecraft.MinecraftProfileTexture;
import com.mojang.authlib.minecraft.MinecraftSessionService;
import net.minecraft.server.v1_15_R1.MinecraftServer;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.craftbukkit.v1_15_R1.CraftServer;
import org.bukkit.craftbukkit.v1_15_R1.entity.CraftPlayer;
import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitRunnable;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;

public class MarkerUpdateTask extends BukkitRunnable {
    private MapToolsPlugin plugin;
    private final LoadingCache<String, GameProfile> offlineProfileCache = CacheBuilder.newBuilder()
            .expireAfterWrite(6, TimeUnit.HOURS)
            .build(new CacheLoader<String, GameProfile>() {
                @Override
                public GameProfile load(String name) throws Exception {
                    GameProfileRepository profileRepository = ((CraftServer) plugin.getServer()).getServer().getGameProfileRepository();
                    final GameProfile[] profile = new GameProfile[1];
                    profileRepository.findProfilesByNames(new String[]{name}, Agent.MINECRAFT, new ProfileLookupCallback() {
                        @Override
                        public void onProfileLookupSucceeded(GameProfile onlineProfile) {
                            profile[0] = onlineProfile;
                        }

                        @Override
                        public void onProfileLookupFailed(GameProfile onlineProfile, Exception e) {
                            profile[0] = onlineProfile;
                        }
                    });
                    return profile[0];
                }
            });

    public MarkerUpdateTask(MapToolsPlugin plugin) {
        this.plugin = plugin;
    }

    public void run() {
        writePlayers(plugin.getServer().getOnlinePlayers(), true);
    }

    public void writePlayers(Collection<? extends Player> collection, boolean asyncWrite) {
        MinecraftSessionService sessionService = ((CraftServer) plugin.getServer()).getServer().getMinecraftSessionService();

        JSONArray playersJson = new JSONArray();
        for (Player player : collection) {
            JSONObject json = new JSONObject();

            Location location = player.getLocation();
            World world = player.getWorld();

            json.put("username", player.getName());
            JSONArray locationJson = new JSONArray();
            locationJson.add(location.getX());
            locationJson.add(location.getY());
            locationJson.add(location.getZ());
            json.put("location", locationJson);
            json.put("world", world.getName());
            json.put("dimension", world.getEnvironment().toString());
            json.put("health", player.getHealth());
            json.put("saturation", player.getSaturation());
            json.put("food", player.getFoodLevel());
            Location bed = player.getBedSpawnLocation();
            if (bed == null) {
                json.put("bed", null);
            } else {
                JSONArray bedJson = new JSONArray();
                bedJson.add(bed.getBlockX());
                bedJson.add(bed.getBlockY());
                bedJson.add(bed.getBlockZ());
                json.put("bed", bedJson);
            }
            json.put("level", (float)player.getLevel() + player.getExp());

            GameProfile profile = ((CraftPlayer) player).getHandle().getProfile();
            if(plugin.getServer().getOnlineMode() == false &&
                    plugin.getConfig().getBoolean("offlineResolveTextures", true)) {
                profile = sessionService.fillProfileProperties(offlineProfileCache.getUnchecked(player.getName()), false);
            }
            Map<MinecraftProfileTexture.Type, MinecraftProfileTexture> textures = sessionService.getTextures(profile, false);
            JSONObject texturesJson = new JSONObject();
            for (Map.Entry<MinecraftProfileTexture.Type, MinecraftProfileTexture> texture: textures.entrySet()) {
                texturesJson.put(texture.getKey().name(), texture.getValue().getUrl());
            }
            json.put("textures", texturesJson);

            playersJson.add(json);
        }
        final JSONObject json = new JSONObject();
        json.put("players", playersJson);

        if(asyncWrite) {
            Bukkit.getServer().getScheduler().runTaskAsynchronously(plugin, new Runnable() {
                @Override
                public void run() {
                    writeToFile(json);
                }
            });
        } else {
            writeToFile(json);
        }
    }

    private void writeToFile(JSONObject json) {
        try {
            File file = new File(plugin.getConfig().getString("markerFile"));
            BufferedWriter output = new BufferedWriter(new FileWriter(file));
            output.write(json.toJSONString());
            output.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
