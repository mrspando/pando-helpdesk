import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function MisTicketsPage() {
  return (
    <div>
      <h1 className="text-[19px] font-semibold text-ink">Mis tickets</h1>
      <EmptyState
        icon={Inbox}
        title="Próximamente"
        description="Pronto podrás ver aquí el estado de tus tickets."
      />
    </div>
  );
}
