"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, UserRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction } from "@/modules/profile/application/actions";
const profileSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(160),
});
type ProfileValues = z.infer<typeof profileSchema>;
export function ProfileNameForm({ name }: { name: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name },
  });
  async function onSubmit(values: ProfileValues) {
    setServerError(null);
    const result = await updateProfileAction(values);
    if (!result.ok) return setServerError(result.error.message);
    toast.success("Имя обновлено");
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError ? <Alert>{serverError}</Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="profile-name">Имя</Label>
        <Input
          id="profile-name"
          {...register("name")}
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name ? (
          <p className="text-destructive text-xs">{errors.name.message}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <UserRound />
        )}{" "}
        Сохранить имя
      </Button>
    </form>
  );
}
