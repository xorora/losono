"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { CreateAgentForm } from "@/components/dashboard/create-agent-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

type CreateAgentDialogProps = {
  canCreate: boolean;
  billedSeats: number;
  used: number;
  isPro: boolean;
};

export function CreateAgentDialog({
  canCreate,
  billedSeats,
  used,
  isPro,
}: CreateAgentDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!canCreate}>
          <PlusIcon />
          Create Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <CreateAgentForm
          canCreate={canCreate}
          billedSeats={billedSeats}
          used={used}
          isPro={isPro}
          variant="embedded"
          onCreated={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
