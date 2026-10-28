import React, { useState, useEffect } from 'react';
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { ImageUpload } from "@/components/ui/image-upload";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, User, Lock, Bell, Globe, Save, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiUrl } from "@/lib/api-url";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("profile");
  
  // Profile Form
  const [displayName, setDisplayName] = useState("");
  const [avatarValue, setAvatarValue] = useState<string | undefined>(undefined);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password Form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Notification Preferences
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [activityDigest, setActivityDigest] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.name || "");
      setAvatarValue(user.avatarUrl || undefined);
    }
    const savedEmailNotifs = localStorage.getItem('settings_emailNotifs');
    const savedActivityDigest = localStorage.getItem('settings_activityDigest');
    if (savedEmailNotifs !== null) setEmailNotifs(savedEmailNotifs === 'true');
    if (savedActivityDigest !== null) setActivityDigest(savedActivityDigest === 'true');
  }, [user]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setIsSavingProfile(true);
    
    try {
      const body: Record<string, unknown> = { name: displayName.trim() };
      if (avatarValue !== user?.avatarUrl) {
        body.avatarUrl = avatarValue ?? null;
      }

      const res = await fetch(apiUrl('/api/auth/me'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
         toast({ title: t("settings.profileUpdated"), description: t("settings.profileSaved") });
      } else {
        const err = await res.json().catch(() => ({}));
         throw new Error(err.error || t("common.tryAgain"));
      }
    } catch (error: any) {
       toast({ variant: "destructive", title: t("admin.saveFailed"), description: error?.message || t("common.tryAgain") });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
       toast({ variant: "destructive", title: t("settings.passwordMismatch"), description: t("common.tryAgain") });
      return;
    }
    if (newPassword.length < 8) {
       toast({ variant: "destructive", title: t("settings.passwordTooShort"), description: "Minimum 8 characters." });
      return;
    }

    setIsSavingPassword(true);
    
    try {
      const res = await fetch(apiUrl('/api/auth/change-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.ok) {
         toast({ title: t("settings.changePassword"), description: t("settings.passwordUpdated") });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const err = await res.json().catch(() => ({}));
         throw new Error(err.error || t("common.tryAgain"));
      }
    } catch (error: any) {
       toast({ variant: "destructive", title: t("admin.saveFailed"), description: error?.message || t("common.tryAgain") });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleEmailNotifsChange = (checked: boolean) => {
    setEmailNotifs(checked);
    localStorage.setItem('settings_emailNotifs', checked.toString());
      toast({ title: t("admin.settingsSaved") });
  };

  const handleActivityDigestChange = (checked: boolean) => {
    setActivityDigest(checked);
    localStorage.setItem('settings_activityDigest', checked.toString());
      toast({ title: t("admin.settingsSaved") });
  };

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    toast({
      title: i18n.t("settings.languageUpdated"),
      description: i18n.t("settings.languageChanged", {
        language: value === "en" ? i18n.t("settings.english") : i18n.t("settings.french"),
      }),
    });
  };

  const profileChanged = displayName.trim() !== (user?.name || "") || avatarValue !== (user?.avatarUrl || undefined);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
           <h1 className="text-3xl font-serif font-bold tracking-tight">{t("settings.title")}</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            {t("settings.description")}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col md:flex-row gap-8">
          <TabsList className="flex flex-col w-full md:w-64 h-auto bg-transparent items-start space-y-1 p-0 shrink-0">
            <TabsTrigger 
              value="profile" 
              className="w-full justify-start px-4 py-3 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border"
            >
               <User className="mr-2 h-4 w-4" /> {t("settings.profile")}
            </TabsTrigger>
            <TabsTrigger 
              value="security" 
              className="w-full justify-start px-4 py-3 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border"
            >
               <Lock className="mr-2 h-4 w-4" /> {t("settings.security")}
            </TabsTrigger>
            <TabsTrigger 
              value="notifications" 
              className="w-full justify-start px-4 py-3 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border"
            >
               <Bell className="mr-2 h-4 w-4" /> {t("settings.notifications")}
            </TabsTrigger>
            <TabsTrigger 
              value="language" 
              className="w-full justify-start px-4 py-3 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border"
            >
               <Globe className="mr-2 h-4 w-4" /> {t("settings.languageRegion")}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-w-0">
            <TabsContent value="profile" className="mt-0 focus-visible:outline-none space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif">{t("settings.publicProfile")}</CardTitle>
                  <CardDescription>{t("settings.publicProfileDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form id="profile-form" onSubmit={handleProfileSave} className="space-y-6">
                    <div className="flex flex-col sm:flex-row gap-6 items-start">
                      <div className="shrink-0">
                         <Label className="text-sm font-medium mb-2 block">{t("settings.profilePicture")}</Label>
                        <ImageUpload
                          value={avatarValue}
                          onChange={(val) => setAvatarValue(val)}
                          label=""
                          aspectRatio="square"
                          className="w-32"
                           placeholder={t("settings.uploadPhoto")}
                        />
                        <p className="text-xs text-muted-foreground mt-1 text-center">PNG, JPG up to 2MB</p>
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="grid gap-2">
                           <Label htmlFor="displayName">{t("settings.displayName")}</Label>
                          <Input 
                            id="displayName" 
                            value={displayName} 
                            onChange={(e) => setDisplayName(e.target.value)} 
                            required
                             placeholder={t("settings.yourFullName")}
                          />
                        </div>
                        <div className="grid gap-2">
                           <Label htmlFor="email">{t("common.email")}</Label>
                          <Input 
                            id="email" 
                            value={user?.email || ""} 
                            readOnly 
                            disabled
                            className="bg-muted"
                          />
                           <p className="text-xs text-muted-foreground">{t("settings.emailCannotChange")}</p>
                        </div>
                      </div>
                    </div>
                  </form>
                </CardContent>
                <CardFooter className="bg-muted/30 border-t px-6 py-4">
                  <Button type="submit" form="profile-form" disabled={isSavingProfile || !displayName.trim() || !profileChanged}>
                    {isSavingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                     {t("settings.saveChanges")}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="mt-0 focus-visible:outline-none space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif">{t("settings.changePassword")}</CardTitle>
                  <CardDescription>{t("settings.changePasswordDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form id="password-form" onSubmit={handlePasswordSave} className="space-y-4 max-w-md">
                    <div className="grid gap-2">
                       <Label htmlFor="currentPassword">{t("settings.currentPassword")}</Label>
                      <Input 
                        id="currentPassword" 
                        type="password" 
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                         placeholder={t("settings.currentPassword")}
                      />
                    </div>
                    <div className="grid gap-2 pt-2">
                       <Label htmlFor="newPassword">{t("settings.newPassword")}</Label>
                      <Input 
                        id="newPassword" 
                        type="password" 
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                         placeholder="Minimum 8 characters"
                      />
                    </div>
                    <div className="grid gap-2">
                       <Label htmlFor="confirmPassword">{t("settings.confirmNewPassword")}</Label>
                      <Input 
                        id="confirmPassword" 
                        type="password" 
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                         placeholder={t("settings.confirmNewPassword")}
                      />
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                           <AlertTriangle className="h-3 w-3" /> {t("settings.passwordMismatch")}
                        </p>
                      )}
                    </div>
                  </form>
                </CardContent>
                <CardFooter className="bg-muted/30 border-t px-6 py-4">
                  <Button 
                    type="submit" 
                    form="password-form" 
                    disabled={isSavingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  >
                    {isSavingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                     {t("settings.updatePassword")}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="mt-0 focus-visible:outline-none space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif">{t("settings.emailNotifications")}</CardTitle>
                  <CardDescription>{t("settings.emailNotificationsDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between space-x-4">
                    <div className="space-y-1">
                       <Label className="text-base font-medium">{t("settings.importantUpdates")}</Label>
                       <p className="text-sm text-muted-foreground">{t("settings.importantUpdatesDescription")}</p>
                    </div>
                    <Switch checked={emailNotifs} onCheckedChange={handleEmailNotifsChange} />
                  </div>
                  
                  <div className="border-t pt-6 flex items-center justify-between space-x-4">
                    <div className="space-y-1">
                       <Label className="text-base font-medium">{t("settings.weeklyDigest")}</Label>
                       <p className="text-sm text-muted-foreground">{t("settings.weeklyDigestDescription")}</p>
                    </div>
                    <Switch checked={activityDigest} onCheckedChange={handleActivityDigestChange} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="language" className="mt-0 focus-visible:outline-none space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif">{t("settings.languageRegion")}</CardTitle>
                  <CardDescription>{t("settings.languageRegionDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 max-w-sm">
                     <Label htmlFor="language">{t("settings.displayLanguage")}</Label>
                    <Select value={i18n.language.startsWith('fr') ? 'fr' : 'en'} onValueChange={handleLanguageChange}>
                      <SelectTrigger id="language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                         <SelectItem value="en">{t("settings.english")}</SelectItem>
                         <SelectItem value="fr">{t("settings.french")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
