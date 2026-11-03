import React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useLogin } from "@workspace/api-client-react";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, ArrowRight } from "lucide-react";
import { EvenumAuthMark } from "@/components/branding/EvenumLogo";
import { useTranslation } from "react-i18next";
import { AuthLoadingShell } from "@/components/loading/LoadingStates";
import { getSafeAuthReturnPath } from "@/lib/auth-redirect";
import { SocialLogin } from "@/components/auth/SocialLogin";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const login = useLogin();
  const { user, isAuthenticated, isLoading: isAuthLoading, isSessionUnavailable, retrySession } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const returnPath = getSafeAuthReturnPath();
  const authError = new URLSearchParams(window.location.search).get("authError");
  const socialError = authError?.endsWith("_account_link_required")
    ? "This email already has a ROBLYNE account. Sign in with your password, then contact support to link the provider."
    : authError?.endsWith("_cancelled")
      ? "Social sign-in was cancelled."
      : authError
        ? "Social sign-in could not be completed. Please try again."
        : null;
  const loginSchema = z.object({
    email: z.string().email(t("auth.emailValidation")),
    password: z.string().min(1, t("auth.passwordRequired")),
  });

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema as any),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  React.useEffect(() => {
    if (isAuthenticated) {
      setLocation(returnPath ?? (user?.isPlatformAdmin ? "/admin" : "/dashboard"));
    }
  }, [isAuthenticated, returnPath, user?.isPlatformAdmin, setLocation]);

  function onSubmit(values: z.infer<typeof loginSchema>) {
    login.mutate(
      { data: values },
      {
        onSuccess: async (loggedInUser) => {
          queryClient.setQueryData(getGetMeQueryKey(), loggedInUser);
          await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast({
             title: t("auth.welcomeBack"),
             description: t("auth.signInSuccess"),
          });
          setLocation(returnPath ?? (loggedInUser.isPlatformAdmin ? "/admin" : "/dashboard"));
        },
        onError: (error) => {
          toast({
            variant: "destructive",
             title: t("auth.signInFailed"),
             description: error.data?.error || t("auth.checkCredentials"),
          });
        },
      }
    );
  }

  if (isAuthLoading) {
    return <AuthLoadingShell />;
  }

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-4 bg-background relative overflow-hidden paper-grain">
        <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none -translate-x-1/2" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-secondary/30 rounded-full blur-[150px] pointer-events-none translate-x-1/3 translate-y-1/3" />
        
        <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
          {isSessionUnavailable && (
            <div role="alert" className="mb-6 rounded-sm border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground">
              We could not restore your session. You can sign in below or <button type="button" onClick={retrySession} className="font-medium text-primary underline underline-offset-2">try again</button>.
            </div>
          )}
          {socialError && (
            <div role="alert" className="mb-6 rounded-sm border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
              {socialError}
            </div>
          )}
          <div className="mb-10 text-center">
            <div className="flex justify-center mb-6">
              <EvenumAuthMark />
            </div>
             <h1 className="text-4xl font-serif font-bold tracking-tight mb-3">{t("auth.signInToEvenum")}</h1>
             <p className="text-muted-foreground text-lg font-light">{t("auth.enterDetails")}</p>
          </div>

          <Card className="border-border shadow-xl bg-card/80 backdrop-blur-sm rounded-sm">
            <CardContent className="pt-8 px-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">{t("auth.emailAddress")}</FormLabel>
                        <FormControl>
                          <Input 
                            type="email"
                            autoComplete="email"
                            placeholder="name@example.com" 
                            {...field} 
                            className="h-12 bg-background border-border/60 focus:border-primary rounded-sm text-base px-4" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">{t("auth.password")}</FormLabel>
                          <Link href="/password-reset" className="text-sm text-primary hover:underline">{t("auth.forgotPassword")}</Link>
                        </div>
                        <FormControl>
                          <Input 
                            type="password" 
                            autoComplete="current-password"
                            placeholder="••••••••" 
                            {...field} 
                            className="h-12 bg-background border-border/60 focus:border-primary rounded-sm text-base px-4" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-14 text-lg font-medium mt-4 shadow-md hover:shadow-lg transition-all" disabled={login.isPending}>
                     {login.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : t("auth.signInButton")}
                    {!login.isPending && <ArrowRight className="ml-2 h-5 w-5" />}
                  </Button>
                </form>
              </Form>
              <SocialLogin returnTo={returnPath ?? "/dashboard"} />
            </CardContent>
            <CardFooter className="flex justify-center border-t border-border/50 py-6 bg-muted/10">
              <p className="text-base text-muted-foreground font-light">
                 {t("auth.noAccount")}{" "}
                <Link href={`/register${window.location.search}`} className="text-primary font-medium hover:underline transition-all">
                   {t("auth.createAccount")}
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
