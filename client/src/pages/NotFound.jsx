import { Link } from "react-router-dom";
import { Shell } from "../components/Layout.jsx";
import { Button } from "../components/ui.jsx";

export default function NotFound() {
  return (
    <Shell>
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-3xl font-extrabold">That page does not exist</h1>
        <p className="mt-2 text-muted">Check the link, or go back home and join a game with a code.</p>
        <Link to="/" className="mt-6 inline-block">
          <Button>Back to home</Button>
        </Link>
      </div>
    </Shell>
  );
}
