import React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useRegister } from "@workspace/api-client-react";
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

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const registerSchema = z.object({
    name: z.string().min(1, t("auth.nameRequired")),
    email: z.string().email(t("auth.emailValidation")),
    password: z.string().min(8, t("auth.passwordMinLength")),
  });

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema as any),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  React.useEffect(() => {
    if (isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, setLocation]);

  function onSubmit(values: z.infer<typeof registerSchema>) {
    registerMutation.mutate(
      { data: values },
      {
        onSuccess: async (registeredUser) => {
          queryClient.setQueryData(getGetMeQueryKey(), registeredUser);
          await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast({
             title: t("auth.accountCreated"),
             description: t("auth.welcomeToEvenum"),
          });
          setLocation("/dashboard");
        },
        onError: (error) => {
          toast({
            variant: "destructive",
             title: t("auth.registrationFailed"),
             description: error.data?.error || t("auth.registrationError"),
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
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-1/4 left-0 w-[600px] h-[600px] bg-secondary/30 rounded-full blur-[150px] pointer-events-none -translate-x-1/2" />
        
        <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="mb-10 text-center">
            <div className="flex justify-center mb-6">
              <EvenumAuthMark />
            </div>
             <h1 className="text-4xl font-serif font-bold tracking-tight mb-3">{t("auth.createAccount")}</h1>
             <p className="text-muted-foreground text-lg font-light">{t("auth.startManaging")}</p>
          </div>

          <Card className="border-border shadow-xl bg-card/80 backdrop-blur-sm rounded-sm">
            <CardContent className="pt-8 px-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">{t("auth.fullName")}</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Jane Doe" 
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
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">{t("auth.emailAddress")}</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
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
                         <FormLabel className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">{t("auth.password")}</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="••••••••" 
                            {...field} 
                            className="h-12 bg-background border-border/60 focus:border-primary rounded-sm text-base px-4" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-14 text-lg font-medium mt-4 shadow-md hover:shadow-lg transition-all" disabled={registerMutation.isPending}>
                     {registerMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : t("auth.createAccountButton")}
                    {!registerMutation.isPending && <ArrowRight className="ml-2 h-5 w-5" />}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex justify-center border-t border-border/50 py-6 bg-muted/10">
              <p className="text-base text-muted-foreground font-light">
                 {t("auth.alreadyHaveAccount")}{" "}
                <Link href="/login" className="text-primary font-medium hover:underline transition-all">
                   {t("auth.signInLink")}
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
