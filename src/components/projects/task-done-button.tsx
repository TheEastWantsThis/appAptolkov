"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setProjectTaskStatusAction } from "@/modules/projects/application/actions";

export function TaskDoneButton({
  taskId,
  projectId,
}: {
  taskId: string;
  projectId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const result = await setProjectTaskStatusAction({
          taskId,
          projectId,
          status: "DONE",
        });
        setPending(false);
        if (!result.ok) toast.error(result.error.message);
        else {
          toast.success("Задача завершена");
          router.refresh();
        }
      }}
    >
      {pending ? <LoaderCircle className="animate-spin" /> : <Check />}Готово
    </Button>
  );
}
