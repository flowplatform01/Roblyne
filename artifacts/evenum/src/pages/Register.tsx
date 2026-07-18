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

const registerSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
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
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast({
            title: "Account created",
            description: "Welcome to Evenum!",
          });
          setLocation("/dashboard");
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Registration failed",
            description: error.data?.error || "There was a problem creating your account.",
          });
        },
      }
    );
  }

  if (isAuthLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-4 bg-background relative overflow-hidden paper-grain">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-1/4 left-0 w-[600px] h-[600px] bg-secondary/30 rounded-full blur-[150px] pointer-events-none -translate-x-1/2" />
        
        <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="mb-10 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-sm bg-primary mb-6 shadow-md text-primary-foreground font-serif font-bold text-3xl leading-none">
              E
            </div>
            <h1 className="text-4xl font-serif font-bold tracking-tight mb-3">Create an Account</h1>
            <p className="text-muted-foreground text-lg font-light">Start managing professional events and elections.</p>
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
                        <FormLabel className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Full Name</FormLabel>
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
                        <FormLabel className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Email Address</FormLabel>
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
                        <FormLabel className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Password</FormLabel>
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
                    {registerMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Create Account"}
                    {!registerMutation.isPending && <ArrowRight className="ml-2 h-5 w-5" />}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex justify-center border-t border-border/50 py-6 bg-muted/10">
              <p className="text-base text-muted-foreground font-light">
                Already have an account?{" "}
                <Link href="/login" className="text-primary font-medium hover:underline transition-all">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
