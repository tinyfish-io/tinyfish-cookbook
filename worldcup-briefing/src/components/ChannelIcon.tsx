/* Brand icons for the notification channels (Telegram, Discord, Slack). Used in the
   add-channel form, channel cards, the schedule channel picker, and every popup
   that references a channel. Default to brand colors; pass `mono` to inherit
   the current text color instead. */

type IconProps = { size?: number; className?: string; mono?: boolean };

export function TelegramIcon({ size = 16, className, mono = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill={mono ? "currentColor" : "#229ED9"} aria-hidden="true">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.061 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

export function DiscordIcon({ size = 16, className, mono = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill={mono ? "currentColor" : "#5865F2"} aria-hidden="true">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}

export function SlackIcon({ size = 16, className, mono = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M9.1 2.4a2.3 2.3 0 0 1 4.6 0v5.7a2.3 2.3 0 1 1-4.6 0V2.4Z" fill={mono ? "currentColor" : "#36C5F0"} />
      <path d="M21.6 9.1a2.3 2.3 0 0 1 0 4.6h-5.7a2.3 2.3 0 1 1 0-4.6h5.7Z" fill={mono ? "currentColor" : "#2EB67D"} />
      <path d="M14.9 21.6a2.3 2.3 0 0 1-4.6 0v-5.7a2.3 2.3 0 1 1 4.6 0v5.7Z" fill={mono ? "currentColor" : "#ECB22E"} />
      <path d="M2.4 14.9a2.3 2.3 0 0 1 0-4.6h5.7a2.3 2.3 0 1 1 0 4.6H2.4Z" fill={mono ? "currentColor" : "#E01E5A"} />
      <path d="M14.9 2.4a2.3 2.3 0 0 1 4.6 0 2.3 2.3 0 0 1-2.3 2.3h-2.3V2.4Z" fill={mono ? "currentColor" : "#2EB67D"} />
      <path d="M21.6 14.9a2.3 2.3 0 0 1 0 4.6 2.3 2.3 0 0 1-2.3-2.3v-2.3h2.3Z" fill={mono ? "currentColor" : "#ECB22E"} />
      <path d="M9.1 21.6a2.3 2.3 0 0 1-4.6 0 2.3 2.3 0 0 1 2.3-2.3h2.3v2.3Z" fill={mono ? "currentColor" : "#E01E5A"} />
      <path d="M2.4 9.1a2.3 2.3 0 0 1 0-4.6 2.3 2.3 0 0 1 2.3 2.3v2.3H2.4Z" fill={mono ? "currentColor" : "#36C5F0"} />
    </svg>
  );
}

export default function ChannelIcon({ type, size = 16, className, mono }: { type: string } & IconProps) {
  const t = type.toLowerCase();
  if (t === "telegram") return <TelegramIcon size={size} className={className} mono={mono} />;
  if (t === "discord") return <DiscordIcon size={size} className={className} mono={mono} />;
  if (t === "slack") return <SlackIcon size={size} className={className} mono={mono} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
