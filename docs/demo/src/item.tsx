import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { albumOf, albums } from "./data";

const tabs = ["tracks", "about"] as const;

export function Item() {
  const id = Number(useParams().id);
  const album = albumOf(id) ?? albums[0];
  const [search, setSearch] = useSearchParams();
  const tab = search.get("tab") === "about" ? "about" : "tracks";
  const navigate = useNavigate();
  const next = albumOf(id + 1) ?? albums[0];

  return (
    <main className="page">
      <button className="back" onClick={() => navigate(-1)}>
        ‹ Back
      </button>
      <div className="hero" style={{ "--hue": album.hue } as object} />
      <h1>{album.title}</h1>
      <Link className="artist" to={`/artists/${album.artist}`}>
        {album.artist} ›
      </Link>
      {/* A replace on the same path: the same screen, no slide. */}
      <nav className="tabs">
        {tabs.map((name) => (
          <button
            key={name}
            aria-pressed={tab === name}
            onClick={() => setSearch({ tab: name }, { replace: true })}
          >
            {name}
          </button>
        ))}
      </nav>
      {tab === "tracks" ? (
        <ol className="tracks">
          {Array.from({ length: 12 }, (_, i) => (
            <li key={i}>
              <Link to={`/items/${album.id}/tracks/${i + 1}`}>
                Track {i + 1}
                <span>›</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p>
          Type a note, open the next album, then come back: the screen was kept,
          note and scroll included.
        </p>
      )}
      <input className="note" placeholder="A note on this album" />
      <Link className="next" to={`/items/${next.id}`}>
        Next: {next.title} ›
      </Link>
    </main>
  );
}
