import { Link, useNavigate, useParams } from "react-router";
import { albums } from "./data";

export function Artist() {
  const { name } = useParams();
  const navigate = useNavigate();

  return (
    <main className="page">
      <button className="back" onClick={() => navigate(-1)}>
        ‹ Back
      </button>
      <h1>{name}</h1>
      <ul className="list">
        {albums
          .filter((album) => album.artist === name)
          .map((album) => (
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
