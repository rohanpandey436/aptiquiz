import { Component } from "react";
import { PetDog } from "./NetworkPet.jsx";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("Unexpected error", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
        <PetDog className="w-56 max-w-[70vw]" />
        <h1 className="display text-3xl font-extrabold text-ink">Something tripped over a cable.</h1>
        <p className="max-w-md text-muted">This screen hit a snag. Your game and score are safe on the server. Reload to pick up where you were.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="press rounded-full bg-brand-700 px-6 py-3 font-semibold text-white shadow-[0_10px_22px_-10px_rgba(29,78,216,0.65)] hover:bg-brand-800"
        >
          Reload
        </button>
      </div>
    );
  }
}
