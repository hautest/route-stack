import { Link } from "react-router";
import { albums, artists } from "./data";

export function Home() {
  return (
    <main className="page">
      <h1>Albums</h1>
      <h2>Featured</h2>
      {/* A horizontal scroller follows the stack's overflow variable. */}
      <div className="carousel">
        {albums.slice(0, 8).map((album) => (
          <Link key={album.id} to={`/items/${album.id}`} className="tile">
            <span className="cover" style={{ "--hue": album.hue } as object} />
            {album.title}
          </Link>
        ))}
      </div>
      <h2>Artists</h2>
      <div className="chips">
        {artists.map((name) => (
          <Link key={name} to={`/artists/${name}`}>
            {name}
          </Link>
        ))}
      </div>
      <h2>All</h2>
      <ul className="list">
        {albums.map((album) => (
          <li key={album.id}>
            <Link to={`/items/${album.id}`}>
              <span
                className="cover"
                style={{ "--hue": album.hue } as object}
              />
              <span>
                {album.title}
                <small>#{album.id}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
