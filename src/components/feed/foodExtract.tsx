/**
 * Food category: compact card vs full detail modal.
 */

const PIN = "\u{1F4CD}";

type MustTryItem = { name?: string; why?: string; signals?: string };

function DietaryChips({ notes }: { notes: string[] | undefined }) {
  if (!notes?.length) return null;
  return (
    <>
      {notes.filter(Boolean).map((note) => (
        <span
          key={note}
          className="text-xs text-amber-700/90 dark:text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded"
        >
          {note}
        </span>
      ))}
    </>
  );
}

/** Feed card: name, tags, location, pull quote only */
export function FoodExtractCard({ data }: { data: Record<string, unknown> }) {
  const name = data.name as string | undefined;
  const address = data.address as string | undefined;
  const cuisine = data.cuisine as string | undefined;
  const whyVisit = data.why_visit as string | undefined;
  const priceRange = data.price_range as string | undefined;
  const dietaryNotes = data.dietary_notes as string[] | undefined;

  return (
    <div className="space-y-2">
      {name && <p className="font-semibold text-fa-primary leading-tight">{name}</p>}
      <div className="flex flex-wrap gap-2">
        {cuisine && (
          <span className="text-xs text-fa-dim bg-fa-chip px-2 py-0.5 rounded">{cuisine}</span>
        )}
        {priceRange && (
          <span className="text-xs text-[#f97316] font-mono bg-fa-chip px-2 py-0.5 rounded">
            {priceRange}
          </span>
        )}
        <DietaryChips notes={dietaryNotes} />
      </div>
      {address && (
        <p className="text-xs text-fa-secondary-alt flex items-start gap-1">
          <span className="mt-0.5">{PIN}</span>
          <span>{address}</span>
        </p>
      )}
      {whyVisit && (
        <p className="text-xs text-fa-soft leading-relaxed border-l-2 border-[#f97316]/30 pl-2 italic">
          {whyVisit}
        </p>
      )}
    </div>
  );
}

/** Detail modal: full extraction */
export function FoodExtractModal({ data }: { data: Record<string, unknown> }) {
  const name = data.name as string | undefined;
  const address = data.address as string | undefined;
  const locationBasis = data.location_basis as string | undefined;
  const cuisine = data.cuisine as string | undefined;
  const whyVisit = data.why_visit as string | undefined;
  const priceRange = data.price_range as string | undefined;
  const reviewerAngle = data.reviewer_angle as string | undefined;
  const whatMakesSpecial = data.what_makes_it_special as string[] | undefined;
  const mustTry = data.must_try as MustTryItem[] | undefined;
  const bullets = data.bullets as string[] | undefined;
  const dietaryNotes = data.dietary_notes as string[] | undefined;
  const dishesMentioned = data.dishes_mentioned as string[] | undefined;
  const hours = data.hours as string | undefined;
  const phone = data.phone as string | undefined;

  const dishesLine =
    dishesMentioned?.filter((d) => d.trim().length > 0).join(" · ") ?? "";

  return (
    <div className="space-y-4">
      {name && (
        <p className="font-semibold text-fa-primary text-base leading-tight">{name}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {cuisine && (
          <span className="text-xs text-fa-dim bg-fa-chip px-2 py-0.5 rounded">{cuisine}</span>
        )}
        {priceRange && (
          <span className="text-xs text-[#f97316] font-mono bg-fa-chip px-2 py-0.5 rounded">
            {priceRange}
          </span>
        )}
        <DietaryChips notes={dietaryNotes} />
      </div>
      {address && (
        <div className="space-y-1">
          <p className="text-sm text-fa-secondary-alt flex items-start gap-1.5">
            <span className="mt-0.5 flex-shrink-0">{PIN}</span>
            <span>{address}</span>
          </p>
          {locationBasis && (
            <p className="text-xs text-fa-subtle leading-snug pl-6">{locationBasis}</p>
          )}
        </div>
      )}
      {whyVisit && (
        <p className="text-sm text-fa-soft leading-relaxed border-l-2 border-[#f97316]/30 pl-3 italic">
          {whyVisit}
        </p>
      )}
      {reviewerAngle && (
        <p className="text-sm text-fa-dim leading-relaxed">{reviewerAngle}</p>
      )}
      {whatMakesSpecial && whatMakesSpecial.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle mb-2">
            What stands out
          </p>
          <ul className="space-y-1">
            {whatMakesSpecial.map((line, i) => (
              <li key={i} className="text-sm text-fa-soft flex items-start gap-2">
                <span className="text-[#f97316] mt-0.5 flex-shrink-0">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {mustTry && mustTry.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle mb-2">
            Must try
          </p>
          <ul className="space-y-2">
            {mustTry.map((item, i) => (
              <li
                key={i}
                className="text-sm text-fa-soft border-l-2 border-[#f97316]/25 pl-3"
              >
                {item.name && (
                  <span className="font-medium text-fa-mid">{item.name}</span>
                )}
                {item.why && (
                  <span className="block text-sm text-fa-dim mt-1 leading-relaxed">
                    {item.why}
                  </span>
                )}
                {item.signals && (
                  <span className="block text-xs text-fa-subtle mt-1 italic">
                    {item.signals}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {dishesLine && (
        <p className="text-sm text-fa-dim">
          <span className="font-medium text-fa-subtle">On the menu: </span>
          {dishesLine}
        </p>
      )}
      {bullets && bullets.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle mb-2">
            Details
          </p>
          <ul className="space-y-1.5">
            {bullets.map((b, i) => (
              <li
                key={i}
                className="text-sm text-fa-soft flex items-start gap-2 leading-relaxed"
              >
                <span className="text-fa-subtle flex-shrink-0 mt-0.5">—</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {hours && (
        <p className="text-xs text-fa-dim">
          <span className="font-medium text-fa-subtle">Hours: </span>
          {hours}
        </p>
      )}
      {phone && (
        <p className="text-xs text-fa-dim">
          <span className="font-medium text-fa-subtle">Phone: </span>
          {phone}
        </p>
      )}
    </div>
  );
}
