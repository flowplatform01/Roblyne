import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language.startsWith('fr') ? 'en' : 'fr');
  };

  const currentLang = i18n.language.startsWith('fr') ? 'FR' : 'EN';
  const nextLang = currentLang === 'EN' ? 'FR' : 'EN';

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="text-xs font-semibold tracking-widest px-2 h-8 text-muted-foreground hover:text-foreground"
      title={`Switch to ${nextLang}`}
    >
      {currentLang}
    </Button>
  );
}
