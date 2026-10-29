import { Link, useNavigate, useParams } from "react-router";
import { albumOf, albums } from "./data";

export function Track() {
  const { id, track } = useParams();
  const album = albumOf(Number(id)) ?? albums[0];
  const navigate = useNavigate();
  const number = Number(track);

  return (
    <main className="page">
      <button className="back" onClick={() => navigate(-1)}>
        ‹ Back
      </button>
      <div className="disc" style={{ "--hue": album.hue } as object} />
      <h1>Track {number}</h1>
      <Link className="artist" to={`/items/${album.id}`}>
        {album.title} · {album.artist} ›
      </Link>
      <Link
        className="next"
        to={`/items/${album.id}/tracks/${(number % 12) + 1}`}
      >
        Next track ›
      </Link>
    </main>
  );
}
