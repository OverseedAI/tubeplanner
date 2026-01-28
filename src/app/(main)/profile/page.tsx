import { auth, signOut } from "@/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LogOut, Mail, User } from "lucide-react";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) return null;

  const { name, email, image } = session.user;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-8">
        Profile
      </h1>

      <Card className="p-6">
        {/* Profile header */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="w-20 h-20">
            <AvatarImage src={image ?? undefined} />
            <AvatarFallback className="text-2xl bg-zinc-100 dark:bg-zinc-800">
              {name?.[0] ?? email?.[0] ?? "?"}
            </AvatarFallback>
          </Avatar>

          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {name ?? "Unknown"}
            </h2>
            <p className="text-zinc-500">{email}</p>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Account details */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
            Account Details
          </h3>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
              <User className="w-4 h-4 text-zinc-400" />
              <span className="text-sm">{name ?? "No name set"}</span>
            </div>

            <div className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
              <Mail className="w-4 h-4 text-zinc-400" />
              <span className="text-sm">{email}</span>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Actions */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
            Account Actions
          </h3>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button variant="outline" className="gap-2">
              <LogOut className="w-4 h-4" />
              Sign out
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
