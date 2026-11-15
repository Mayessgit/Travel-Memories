"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const registerSchema = z.object({
  username: z.string().trim().min(3, "Nom d'utilisateur requis (min 3 caractères)").max(50, "Nom d'utilisateur trop long")
    .regex(/^[a-zA-Z0-9_]+$/, "Lettres, chiffres et underscore uniquement"),
  email: z.string().trim().min(1, "Adresse e-mail requise").email("Adresse e-mail invalide"),
  password: z.string().min(8, "Mot de passe trop court (min 8 caractères)")
    .regex(/[A-Z]/, "Ajoutez au moins une majuscule").regex(/[0-9]/, "Ajoutez au moins un chiffre"),
  confirm_password: z.string().min(1, "Confirmez votre mot de passe"),
  full_name: z.string().trim().min(2, "Nom complet requis (min 2 caractères)").max(100, "Nom trop long"),
}).refine((data) => data.password === data.confirm_password, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirm_password"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, isLoading } = useAuthStore();
  const [error, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setErrorMessage(null);
    try {
      const account = {
        username: data.username,
        email: data.email,
        password: data.password,
        full_name: data.full_name,
      };
      await registerUser(account);
      router.push("/my-map");
    } catch (err) {
      if (err instanceof ApiError) {
        const details = (err.data as { error?: { details?: Record<string, string[]> } } | undefined)?.error?.details;
        if (details) {
          for (const [field, messages] of Object.entries(details)) {
            if (messages?.[0] && ["username", "email", "password", "full_name"].includes(field)) {
              setError(field as "username" | "email" | "password" | "full_name", { message: messages[0] });
            }
          }
        }
        if (err.statusCode === 409) {
          const field = /email/i.test(err.message) ? "email" : "username";
          setError(field, { message: err.message });
          setErrorMessage(null);
        } else if (err.statusCode >= 500) {
          setErrorMessage("Problème de connexion au serveur. Vérifiez votre connexion puis réessayez.");
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage("Problème de connexion au serveur. Vérifiez votre connexion puis réessayez.");
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Inscription</CardTitle>
          <CardDescription>
            Créez votre compte pour partager vos aventures
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="full_name">Nom complet</Label>
              <Input
                id="full_name"
                placeholder="Jean Dupont"
                {...register("full_name")}
              />
              {errors.full_name && (
                <p className="text-sm text-red-500">
                  {errors.full_name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Nom d&apos;utilisateur</Label>
              <Input
                id="username"
                placeholder="jean_dupont"
                {...register("username")}
              />
              {errors.username && (
                <p className="text-sm text-red-500">
                  {errors.username.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="jean@exemple.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-red-500">
                  {errors.password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirmer le mot de passe</Label>
              <Input id="confirm_password" type="password" placeholder="••••••••" {...register("confirm_password")} />
              {errors.confirm_password && (
                <p className="text-sm text-red-500">{errors.confirm_password.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Inscription..." : "S'inscrire"}
            </Button>
            <p className="text-center text-sm text-gray-600">
              Déjà un compte ?{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                Se connecter
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
