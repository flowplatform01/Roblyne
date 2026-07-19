import React from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ShareButtonProps {
  url: string;
  title?: string;
  description?: string;
  variant?: 'button' | 'icon';
  className?: string;
}

export function ShareButton({ url, title, description, variant = 'button', className }: ShareButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const { toast } = useToast();

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: description, url });
        return;
      } catch (err) {
        // Fallback to copy
      }
    }
    
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Copied!", description: "Link copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ variant: 'destructive', title: "Failed to copy", description: "Please copy the URL manually." });
    }
  };

  if (variant === 'icon') {
    return (
      <Button variant="ghost" size="icon" onClick={handleShare} className={className} title="Share">
        {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
      </Button>
    );
  }

  return (
    <Button variant="outline" onClick={handleShare} className={cn("gap-2", className)}>
      {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
      Share
    </Button>
  );
}
