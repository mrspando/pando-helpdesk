import { createClient } from "@/lib/supabase/server";

type TicketRow = {
  id: number;
  ref: string | null;
  titulo: string;
  prioridad: string;
  estado: string;
  created_at: string;
  solicitante: { nombre: string | null; email: string } | null;
  categoria: { nombre: string } | null;
};

function formatEnum(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

export default async function TicketsPage() {
  const supabase = await createClient();

  const { data: tickets, error } = await supabase
    .from("tickets")
    .select(
      `id, ref, titulo, prioridad, estado, created_at,
       solicitante:personas!tickets_solicitante_id_fkey(nombre, email),
       categoria:categorias(nombre)`,
    )
    .is("deleted_at", null)
    .order("prioridad", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<TicketRow[]>();

  if (error) {
    return (
      <div className="text-sm text-red-600">
        No se pudo cargar la cola de tickets: {error.message}
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Cola de tickets</h1>
      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2 font-medium">Ref</th>
              <th className="px-4 py-2 font-medium">Título</th>
              <th className="px-4 py-2 font-medium">Solicitante</th>
              <th className="px-4 py-2 font-medium">Categoría</th>
              <th className="px-4 py-2 font-medium">Prioridad</th>
              <th className="px-4 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {tickets?.map((ticket) => (
              <tr
                key={ticket.id}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="px-4 py-2 font-mono text-xs">
                  {ticket.ref ?? `PANDO-${ticket.id}`}
                </td>
                <td className="px-4 py-2">{ticket.titulo}</td>
                <td className="px-4 py-2">
                  {ticket.solicitante?.nombre ?? ticket.solicitante?.email ?? "—"}
                </td>
                <td className="px-4 py-2">
                  {ticket.categoria?.nombre ?? "Sin categoría"}
                </td>
                <td className="px-4 py-2">{formatEnum(ticket.prioridad)}</td>
                <td className="px-4 py-2">{formatEnum(ticket.estado)}</td>
              </tr>
            ))}
            {tickets?.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-zinc-500"
                >
                  No hay tickets.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
