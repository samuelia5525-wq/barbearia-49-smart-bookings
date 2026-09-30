import { addDays, todaySP, weekdayOf } from "@/lib/time";
import { cn } from "@/lib/utils";

const WD = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export function DateStrip({
  value,
  onChange,
  closedWeekdays = [],
  days = 21,
}: {
  value: string | null;
  onChange: (d: string) => void;
  closedWeekdays?: number[];
  days?: number;
}) {
  const today = todaySP();
  const list = Array.from({ length: days }, (_, i) => addDays(today, i));
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 snap-x">
      {list.map((d) => {
        const wd = weekdayOf(d);
        const closed = closedWeekdays.includes(wd);
        const active = value === d;
        return (
          <button
            key={d}
            type="button"
            disabled={closed}
            onClick={() => onChange(d)}
            className={cn(
              "flex w-16 shrink-0 snap-start flex-col items-center rounded-xl border py-3 transition",
              active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/60",
              closed && "cursor-not-allowed opacity-35",
            )}
          >
            <span className="text-[11px] font-semibold tracking-wider">{d === today ? "HOJE" : WD[wd]}</span>
            <span className="font-display text-2xl font-bold">{d.slice(8)}</span>
            <span className="text-[10px] opacity-70">{closed ? "fechado" : d.slice(5, 7) + "/" + d.slice(2, 4)}</span>
          </button>
        );
      })}
    </div>
  );
}
