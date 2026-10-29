export interface Album {
  id: number;
  title: string;
  artist: string;
  hue: number;
}

export const artists = ["Lumen", "Okra", "Pale Fox", "Sora"];

const words = [
  "Morning",
  "Harbor",
  "Neon",
  "Paper",
  "Quiet",
  "Summer",
  "Velvet",
  "Winter",
  "Atlas",
  "Cobalt",
  "Ember",
  "Field",
  "Glass",
  "Hollow",
  "Island",
  "Juniper",
];

export const albums: Album[] = Array.from({ length: 24 }, (_, i) => ({
  id: i + 1,
  title: `${words[i % words.length]} ${["Lights", "Tapes", "Rooms", "Waves"][(i + Math.floor(i / 16)) % 4]}`,
  artist: artists[i % artists.length],
  hue: (i * 47) % 360,
}));

export const albumOf = (id: number) => albums.find((album) => album.id === id);
