interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface Window {
  __iyKurulum?: BeforeInstallPromptEvent | null;
  __iyKurulumHazir?: boolean;
}
