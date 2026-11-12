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
import { Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { EvenumAuthMark } from "@/components/branding/EvenumLogo";
import { useTranslation, Trans } from "react-i18next";
import { AuthLoadingShell } from "@/components/loading/LoadingStates";
import { getSafeAuthReturnPath } from "@/lib/auth-redirect";
import { SocialLogin } from "@/components/auth/SocialLogin";
import { Checkbox } from "@/components/ui/checkbox";
import { apiUrl } from "@/lib/api-url";
import { currentLegalLanguage } from "@/i18n";

type LegalRequirement = { id: number; documentType: "terms" | "privacy"; title: string; version: number; languageFallback?: boolean };

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();
  const { isAuthenticated, isLoading: isAuthLoading, isSessionUnavailable, retrySession } = useAuth();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const returnPath = getSafeAuthReturnPath();
  const authError = new URLSearchParams(window.location.search).get("authError");
  const [legalRequirements, setLegalRequirements] = React.useState<LegalRequirement[]>([]);
  const [missingLegalDocumentTypes, setMissingLegalDocumentTypes] = React.useState<string[]>(["terms", "privacy"]);
  const [acceptedLegalDocumentIds, setAcceptedLegalDocumentIds] = React.useState<number[]>([]);
  const [showPassword, setShowPassword] = React.useState(false);

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
      setLocation(returnPath ?? "/dashboard");
    }
  }, [isAuthenticated, returnPath, setLocation]);

  React.useEffect(() => {
    const controller = new AbortController();
    void fetch(apiUrl(`/api/legal/requirements?lang=${currentLegalLanguage()}`), { signal: controller.signal })
      .then((response) => response.ok ? response.json() : { documents: [] })
      .then((body: { documents?: LegalRequirement[]; missingDocumentTypes?: string[] }) => {
        setLegalRequirements(Array.isArray(body.documents) ? body.documents : []);
        setMissingLegalDocumentTypes(Array.isArray(body.missingDocumentTypes) ? body.missingDocumentTypes : []);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [i18n.language]);

  const termsDoc = legalRequirements.find((doc) => doc.documentType === "terms");
  const privacyDoc = legalRequirements.find((doc) => doc.documentType === "privacy");
  const termsTitle = termsDoc?.title || t("auth.termsOfServiceTitle");
  const privacyTitle = privacyDoc?.title || t("auth.privacyPolicyTitle");
  const isLegalAccepted = legalRequirements.length > 0 && legalRequirements.every((doc) => acceptedLegalDocumentIds.includes(doc.id));

  function onSubmit(values: z.infer<typeof registerSchema>) {
    if (legalRequirements.some((document) => !acceptedLegalDocumentIds.includes(document.id))) {
      toast({
        variant: "destructive",
        title: t("auth.legalReviewTitle"),
        description: t("auth.legalReviewDescription"),
      });
      return;
    }
    registerMutation.mutate(
      { data: { ...values, legalDocumentIds: acceptedLegalDocumentIds } },
      {
        onSuccess: async (registeredUser) => {
          queryClient.setQueryData(getGetMeQueryKey(), registeredUser);
          await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast({
             title: t("auth.accountCreated"),
             description: t("auth.welcomeToEvenum"),
          });
          setLocation(returnPath ?? "/dashboard");
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
      <div className="flex-1 flex items-center justify-center p-4 py-6 sm:py-10 bg-background relative overflow-hidden paper-grain">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-1/4 left-0 w-[600px] h-[600px] bg-secondary/30 rounded-full blur-[150px] pointer-events-none -translate-x-1/2" />
        
        <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
          {isSessionUnavailable && (
            <div role="alert" className="mb-4 sm:mb-6 rounded-sm border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground">
              <Trans
                i18nKey="auth.sessionRestoreFailed"
                values={{ action: t("auth.sessionActionRegister") }}
                components={{ retry: <button type="button" onClick={retrySession} className="font-medium text-primary underline underline-offset-2" /> }}
              />
            </div>
          )}
          {authError === "social_legal_acceptance_required" && (
            <div role="alert" className="mb-4 sm:mb-6 rounded-sm border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground">
              {t("auth.legalSocialAcceptanceRequired")}
            </div>
          )}
          <div className="mb-6 sm:mb-8 text-center">
            <div className="flex justify-center mb-4 sm:mb-5">
              <EvenumAuthMark />
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight mb-1.5 sm:mb-2">{t("auth.createAccount")}</h1>
            <p className="text-muted-foreground text-sm sm:text-base font-light max-w-sm mx-auto">{t("auth.startManaging")}</p>
          </div>

          <Card className="border-border shadow-xl bg-card/80 backdrop-blur-sm rounded-sm">
            <CardContent className="pt-6 sm:pt-8 px-5 sm:px-8 pb-6 sm:pb-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm font-semibold tracking-wide uppercase text-muted-foreground">{t("auth.fullName")}</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Jane Doe" 
                            autoComplete="name"
                            {...field} 
                            className="h-11 sm:h-12 bg-background border-border/60 focus:border-primary rounded-sm text-base px-3.5 sm:px-4" 
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
                        <FormLabel className="text-xs sm:text-sm font-semibold tracking-wide uppercase text-muted-foreground">{t("auth.emailAddress")}</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            autoComplete="email"
                            placeholder="name@example.com" 
                            {...field} 
                            className="h-11 sm:h-12 bg-background border-border/60 focus:border-primary rounded-sm text-base px-3.5 sm:px-4" 
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
                        <FormLabel className="text-xs sm:text-sm font-semibold tracking-wide uppercase text-muted-foreground">{t("auth.password")}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type={showPassword ? "text" : "password"} 
                              autoComplete="new-password"
                              placeholder="••••••••" 
                              {...field} 
                              className="h-11 sm:h-12 bg-background border-border/60 focus:border-primary rounded-sm text-base pl-3.5 sm:pl-4 pr-11" 
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((prev) => !prev)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                              tabIndex={-1}
                            >
                              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {legalRequirements.length > 0 && (
                    <div className="rounded-sm border border-border/70 bg-muted/20 p-3 sm:p-3.5 text-xs sm:text-sm">
                      <label className="flex cursor-pointer items-start gap-3 leading-relaxed select-none">
                        <Checkbox
                          checked={isLegalAccepted}
                          onCheckedChange={(value) => {
                            if (value) {
                              setAcceptedLegalDocumentIds(legalRequirements.map((d) => d.id));
                            } else {
                              setAcceptedLegalDocumentIds([]);
                            }
                          }}
                          aria-label={t("auth.acceptLegalAria", { termsTitle, privacyTitle })}
                          className="mt-0.5 size-4.5 rounded-sm"
                        />
                        <span className="text-foreground/90">
                          <Trans
                            i18nKey="auth.legalConsolidatedAcceptance"
                            values={{ termsTitle, privacyTitle }}
                            components={{
                              termsLink: (
                                <a
                                  href={`/legal/${termsDoc?.documentType || "terms"}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ),
                              privacyLink: (
                                <a
                                  href={`/legal/${privacyDoc?.documentType || "privacy"}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ),
                            }}
                          />
                        </span>
                      </label>
                      {legalRequirements.some((document) => document.languageFallback) && (
                        <p className="mt-2 text-xs text-muted-foreground">{t("auth.legalFallbackNotice")}</p>
                      )}
                    </div>
                  )}

                  {missingLegalDocumentTypes.length > 0 && (
                    <p role="status" className="text-sm text-muted-foreground">{t("auth.registrationLegalUnavailable")}</p>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full h-11 sm:h-12 text-base font-medium mt-2 shadow-md hover:shadow-lg transition-all" 
                    disabled={registerMutation.isPending || missingLegalDocumentTypes.length > 0}
                  >
                    {registerMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : t("auth.createAccountButton")}
                    {!registerMutation.isPending && <ArrowRight className="ml-2 h-5 w-5" />}
                  </Button>
                </form>
              </Form>

              {missingLegalDocumentTypes.length === 0 && (
                <SocialLogin 
                  returnTo={returnPath ?? "/dashboard"} 
                  legalDocumentIds={acceptedLegalDocumentIds} 
                  requiresLegalAcceptance 
                />
              )}
            </CardContent>

            <CardFooter className="flex justify-center border-t border-border/50 py-4 sm:py-5 bg-muted/10">
              <p className="text-sm sm:text-base text-muted-foreground font-light">
                {t("auth.alreadyHaveAccount")}{" "}
                <Link href={`/login${window.location.search}`} className="text-primary font-medium hover:underline transition-all">
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
