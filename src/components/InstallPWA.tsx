import { Download, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWA } from '@/hooks/usePWA';
import { Badge } from '@/components/ui/badge';

export function InstallPWA() {
  const { isInstallable, isInstalled, isOnline, promptInstall } = usePWA();

  if (isInstalled) {
    return null;
  }

  if (!isInstallable) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={promptInstall}
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      Install App
    </Button>
  );
}

export function OnlineStatus() {
  const { isOnline } = usePWA();

  return (
    <Badge variant={isOnline ? 'default' : 'destructive'} className="gap-1">
      {isOnline ? (
        <>
          <Wifi className="h-3 w-3" />
          Online
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          Offline
        </>
      )}
    </Badge>
  );
}
