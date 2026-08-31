export function ChannelAvatar({
  name,
  url,
  large = false,
}: {
  name: string;
  url: string | null;
  large?: boolean;
}) {
  const className = large ? "avatar avatar-large" : "avatar";
  if (!url)
    return (
      <div className={className} aria-hidden="true">
        {name.slice(0, 1).toUpperCase()}
      </div>
    );
  return (
    // User-provided HTTPS URLs cannot be allowlisted ahead of time for next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src={url} alt={large ? `Аватар канала ${name}` : ""} />
  );
}
