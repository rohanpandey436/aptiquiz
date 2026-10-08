export function DataTable({ rows }) {
  if (!rows?.length) return null;
  const [head, ...body] = rows;
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface">
          <tr>
            {head.map((cell, i) => (
              <th key={i} scope="col" className="px-3 py-2 font-semibold text-ink">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r} className="border-t border-line">
              {row.map((cell, c) => (
                <td key={c} className="px-3 py-2 tabular">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QuestionBody({ text, table, image, size = "md" }) {
  const textSize = size === "lg" ? "text-2xl md:text-3xl" : "text-lg md:text-xl";
  return (
    <div className="flex flex-col gap-4">
      <p className={`${textSize} font-bold leading-snug text-ink`}>{text}</p>
      {image ? <img src={image} alt="Question illustration" className="max-h-72 w-auto rounded-xl border border-line object-contain" /> : null}
      {table ? <DataTable rows={table} /> : null}
    </div>
  );
}
