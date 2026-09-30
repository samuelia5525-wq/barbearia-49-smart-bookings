import { Link } from "@tanstack/react-router";
import { Scissors, User } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-primary/60 text-primary">
            <Scissors className="h-4 w-4" />
          </span>
          <span className="font-display text-xl font-bold tracking-wide">
            Barbearia <span className="text-primary">49</span>
          </span>
        </Link>
        <Link
          to="/minha-conta"
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary"
        >
          <User className="h-4 w-4" /> Meus cortes
        </Link>
      </div>
    </header>
  );
}
